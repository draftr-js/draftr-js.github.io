// This file defines how Markdown-formatted Internet-drafts are converted to a
// common intermediate representation.  The entry point you should use is
// fromMD(text).
//
// Most of the work is done in md2blocks, which uses the marked/kramed parser
// to get a series of block-level elements and convert them into our
// intermediate representation.  If you want to swap in a different parser,
// here's where you do it.
//
// The parser is the source of few current limitations:
// * Reference format is standard markdown, not kramdown-2629
// * Blockquote support is limited to a single paragraph
// * Definition lists are not supported


function isIAL(text) {
  return text.match(/^\s*{:.*}\s*$/);
}

function parseIAL(text) {
  var inner = text.replace(/^\s*{:/, "")
                  .replace(/}\s*$/, "")
                  .replace(/&quot;/g, "\"")
                  .trim();
  var attrs = {};

  attrs.anchors = [];
  if (inner.match(/#\w+/)) {
    attrs.anchors.push(inner.match(/#\w+/)[0].substr(1));
  }

  inner.replace(/\w+="[^"]*"/g, function(pair) {
    var key = pair.replace(/=.*$/, "");
    var value = pair.replace(/^\w+="/, "").replace(/"$/, "");
    attrs[key] = value;
  });

  if ("title" in attrs) {
    attrs.anchors.push(attrs.title.toLowerCase().replace(/ /g, "-"));
  }

  return attrs;
}

// md2blocks parses markdown text into an abstract representation, so that
// another function can then render it.  The returned value is an array of
// blocks, where each block is an object.
//
// The following block types are defined:
// * heading
// * paragraph
// * blockquote
// * listitem
// * figure
// * table
//
function md2blocks(mkd, appendix) {
  var renderer = new marked.Renderer();

  function error(feature) {
    return function() { throw "Unsupported markdown: "+feature; }
  }

  function identity(x) {
    return x;
  }

  // State trackers
  var blocks = [];

  // Unsupported functions
  renderer.html = error("html");
  renderer.hr = error("hr");
  renderer.br = error("br");
  renderer.image = error("image");

  // Trivial span-level functions (might render in XML or HTML?)
  renderer.strong = identity;
  renderer.em = identity;
  renderer.codespan = identity;
  renderer.del = identity;

  // Counters for tables and figures
  var figureNumber = 0;
  var tableNumber = 0;

  // Headers
  // TODO: Implicit and explicit xref anchors
  var sections = [0,0,0,0,0,0];
  renderer.heading = function(text, level) {
    flushListCache();

    for (var i=level; i<sections.length; ++i) {
      sections[i] = 0;
    }
    sections[level-1] += 1;

    // Set implicit and explicit anchors
    var anchors = [];
    if (text.match(/{#\w+}\s*$/)) {
      anchors.push(text.replace(/^.*{#/, "").replace(/}.*$/, ""));
      text = text.replace(/{#\w+}\s*$/, "").trim();
    }
    anchors.push(text.toLowerCase().replace(/ /g, "-"));

    renderSections = sections.slice();
    if (appendix) {
      // Change the first indicator to a letter
      var Am1 = "A".charCodeAt(0) - 1;
      renderSections[0] = String.fromCharCode(Am1 + renderSections[0]);
    }
    blocks.push({
      type: "section",
      level: level,
      number: renderSections.slice(0, level).join("."),
      text: text,
      anchors: anchors,
    });
    return "";
  };

  // Paragraphs
  //
  // NB: We need to return the text value here to make blockquote work.  This
  // also implies that blockquote won't work with multiple paragraphs.
  renderer.paragraph = function(text) {
    flushListCache();
    if (isIAL(text)) {
      var label, number;
      var lastBlock = blocks.pop();
      switch (lastBlock.type) {
        case "figure": lastBlock.number = figureNumber; break;
        case "table":  lastBlock.number = tableNumber; break;
        default: console.log("IAT for bad block type:", lastBlock.type);
      }

      var attrs = parseIAL(text);
      for (key in attrs) {
        lastBlock[key] = attrs[key];
      }

      blocks.push(lastBlock);
      return "";
    }

    blocks.push({
      type: "paragraph",
      text: text,
    });
    return text;
  };

  // We leave references in a structured format for later procesing by
  // renderers.
  renderer.link = function(href, title, text) {
    return "[" +text +"]("+ href +")";
  };

  // Blockquotes
  renderer.blockquote = function(text) {
    flushListCache();
    blocks.push({
      type: "blockquote",
      text: text,
    });
    return "";
  };

  // Figures are centered
  renderer.code = function(text) {
    flushListCache();
    figureNumber += 1;
    blocks.push({
      type: "figure",
      text: text,
    });
    return "";
  };

  // For dealing with lists, we use a quasi-markup to deal with
  // the order in which these events are emitted.
  //
  // Because lists are recursive, we don't know we're done until
  // we hit something non-listy.  So handlers for block types
  // other than lists must call flushListCache before they add
  // any blocks.
  var listCache = "";
  var SEP = "<!DRAFTR!>";
  var CMD_OL = "ol";
  var CMD_UL = "ul";
  var CMD_POP = "pop";
  function listBlock(cmds, ordered) {
    var node = {
      type: "listnode",
      ordered: ordered,
      items: [],
    };
    while (cmds.length > 0) {
      var cmd = cmds.shift();
      switch (cmd) {
        case CMD_OL:
        case CMD_UL:
          var newNode = listBlock(cmds, (cmd == CMD_OL));
          node.items[node.items.length-1].ordered = newNode.ordered;
          node.items[node.items.length-1].items = newNode.items;
          break;
        case CMD_POP:
          return node;
        default:
          node.items.push({ type: "listnode", text: cmd });
      }
    }
  }
  function flushListCache() {
    if (listCache.length > 0) {
      var commands = listCache.split(SEP);
      commands.shift(); // Shift blank

      var start = commands.shift();
      blocks.push(listBlock(commands, (start == CMD_OL)));
      listCache = "";
    }
  }
  renderer.list = function(text, ordered) {
    var pushTag = SEP + ((ordered)? CMD_OL : CMD_UL);
    listCache = pushTag + text + (SEP + CMD_POP);
    return listCache;
  };
  renderer.listitem = function(text) {
    return SEP + text; // No need for close tags
  };

  // Table handling
  var tableRowCache = { cells: [], flags: [] };
  var tableCache = [];
  var tableAlignment = [];
  renderer.tablerow = function() {
    if (tableCache.length > 0 &&
        tableCache[0].cells.length != tableRowCache.cells.length) {
      throw "Improper table: Uneven row lengths";
    }
    tableCache.push(tableRowCache);
    tableRowCache = { cells: [], flags: [] };
  };
  renderer.tablecell = function(text, flags) {
    tableRowCache.cells.push(text);
    tableRowCache.flags.push(flags);
  };
  renderer.table = function(content) {
    flushListCache();
    blocks.push({
      type: "table",
      data: tableCache.slice(),
    });
    tableCache = [];
    tableNumber += 1;
    return "";
  };

  marked(mkd, { renderer: renderer });
  return blocks;
}

// fromMD does the full parse on the whole RFC 2629 file, including splitting
// it into multiple chapters and YAML-parsing the front block
function fromMD(text) {
  var AST = {
    front: {},
    notes: [],
    abstract: [],
    middle: [],
    back: []
  };

  var lines = text.split("\n");
  var divider = lines[0];

  // Split into top level chapters
  var lineNumber = -1;
  var lastChapterEnd = 0;
  var chapterMeta = [];
  var chapters = []
  lines.forEach(function(line) {
    lineNumber += 1;
    if ((line.indexOf(divider) != 0) || (lineNumber == 0) ||
        (!/^\s+\S+/.test(line.substring(divider.length))))
      return;

    var content = line.substring(divider.length).trim();
    var type = content.replace(/\s.*$/, '');
    var title = content.replace(/^[^\s]*\s*/, '');
    chapterMeta.push({ type: type, title: title });
    chapters.push(lines.slice(lastChapterEnd+1, lineNumber));
    lastChapterEnd = lineNumber;
  });
  chapters.push(lines.slice(lastChapterEnd+1));

  // The first chapter forms the bulk of the front matter
  AST.front = YAML.parse(chapters.shift().join("\n"));

  // The remainder of the chapters are parsed as markdown
  for (var i=0; i < chapters.length; ++i) {
    var blocks = md2blocks(chapters[i].join("\n"), (chapterMeta[i].type == "back"));

    switch (chapterMeta[i].type) {
      case "note":
        AST.notes.push({
          type: "section",
          text: chapterMeta[i].title,
        });
        AST.notes = AST.notes.concat(blocks)
      case "abstract":
        blocks.unshift({
          type: "section",
          text: "Abstract",
        });
        AST.abstract = blocks;
        break;
      case "middle": AST.middle = blocks; break;
      case "back": AST.back = blocks; break;
      default:
        console.log("unknown chapter type: ["+ chapterMeta[i].type +"]");
    }
  }

  return AST;
}
