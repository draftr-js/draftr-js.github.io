// This file defines how an intermediate representation structure is rendered to
// idnits-compatible TXT format.  The entry point you should use is toTXT.
//
// Rendering proceeds in a few stages:
// 1. References are pulled from the AST, replaced in the text, and rendered.
// 2. Section table is pulled from the AST and a stub TOC rendered.
// 3. Basic rendering and pagination is done (separately) on the front matter,
//    main matter, and back matter
// 4. The stub TOC is populated with the final page numbers
//
// In general renderFOO functions return a list of lists (blocks) of lines, where
// a block represents a group of lines that should not be split by pagination.

(function() {

// Page layout constants
var PAGE_HEIGHT = 54;
var TITLE_WIDTH = 60;
var PARAGRAPH_INDENT = 3;
var BLOCKQUOTE_INDENT = 6;
var TOC_NUMBER_WIDTH = 4;
var PAGE_BREAK = "\u000c\u000a";

function wrapText(text, indent, width) {
  if (!indent || !width) {
    return [ text ];
  }

  var tokens = text.split(/\s+/);
  var lines = []
  var tab = blank(indent - 1);

  while (tokens.length > 0) {
    var currLine = tab;

    // Deal with oversized tokens
    if (currLine.length + tokens[0].length + 1 > width) {
      lines.push(currLine + " " + tokens.shift());
    }

    while ((tokens.length > 0) &&
           (currLine.length + tokens[0].length + 1 <= width)) {
      currLine += " " + tokens.shift();
    }
    lines.push(currLine);
  }
  return lines;
}

///// HEADER RENDERING /////

function insertRightAligned(src, dst) {
  return dst.substring(0, dst.length-src.length) + src;
}

function insertLeftAligned(src, dst) {
  return src + dst.substring(src.length);
}

function insertCentered(src, dst) {
  var start = Math.floor((dst.length - src.length) / 2);
  return dst.substring(0, start) + src + dst.substring(start + src.length);
}

function renderStatus(stat) {
  switch (stat.toLowerCase()) {
    case "std":  return "Standards Track";
    case "info": return "Informational";
    case "exp":  return "Experimental";
    case "bcp":  return "BCP";
  }
  return "Unknown";
}

function addSixMonths(date) {
  var ret = new Date(date);
  ret.setUTCMonth(date.getUTCMonth() + 6);
  if (ret.getUTCMonth() < 6) {
    ret.setUTCFullYear(date.getUTCFullYear() + 1);
  }
  return ret;
}

function renderDate(date) {
  return months[date.getUTCMonth()] + " " +
         date.getUTCDate() + ", " +
         date.getUTCFullYear();
}
function renderHeaderDate(date) {
  return months[date.getUTCMonth()] + " " + date.getUTCFullYear();
}

function renderPageNumber(n) {
  return "[Page " + n + "]";
}

var BOILERPLATE_TRUST200902 = [
  [
    "Status of this Memo",
    "",
    "   This Internet-Draft is submitted in full conformance with the",
    "   provisions of BCP 78 and BCP 79.",
  ],
  [
    "   Internet-Drafts are working documents of the Internet Engineering",
    "   Task Force (IETF).  Note that other groups may also distribute",
    "   working documents as Internet-Drafts.  The list of current Internet-",
    "   Drafts is at http://datatracker.ietf.org/drafts/current/.",
  ],
  [
    "   Internet-Drafts are draft documents valid for a maximum of six months",
    "   and may be updated, replaced, or obsoleted by other documents at any",
    "   time.  It is inappropriate to use Internet-Drafts as reference",
    "   material or to cite them other than as \"work in progress.\"",
  ],
  [
    "   This Internet-Draft will expire on EXPIRY_DATE.",
  ],
  [
    "Copyright Notice",
    "",
    "   Copyright (c) CURRENT_YEAR IETF Trust and the persons identified as the",
    "   document authors.  All rights reserved.",
  ],
  [
    "   This document is subject to BCP 78 and the IETF Trust's Legal",
    "   Provisions Relating to IETF Documents",
    "   (http://trustee.ietf.org/license-info) in effect on the date of",
    "   publication of this document.  Please review these documents",
    "   carefully, as they describe your rights and restrictions with respect",
    "   to this document.  Code Components extracted from this document must",
    "   include Simplified BSD License text as described in Section 4.e of",
    "   the Trust Legal Provisions and are provided without warranty as",
    "   described in the Simplified BSD License.",
  ]
];

function renderFrontMatter(metadata) {
  var line;
  var expiry = addSixMonths(metadata.date);
  var lCol = [
    "Network Working Group",
    "Internet-Draft",
    "Intended status: " + renderStatus(metadata.cat),
    "Expires: " + renderDate(expiry)
  ];
  var rCol = [];
  for (i in metadata.author) {
    i = parseInt(i);
    rCol.push(metadata.author[i].ins);
    if ((i >= metadata.author.length-1) ||
        (metadata.author[i].org != metadata.author[i+1].org)) {
      rCol.push(metadata.author[i].org);
    }
  }
  rCol.push(renderDate(metadata.date));
  var headerLines = [];
  for (var i=0; i<Math.max(lCol.length, rCol.length); ++i) {
    line = blank(PAGE_WIDTH);
    if (i < lCol.length) { line = insertLeftAligned(lCol[i], line); }
    if (i < rCol.length) { line = insertRightAligned(rCol[i], line); }
    headerLines.push(line);
  }
  headerLines.push(""); // Two blank lines before title
  headerLines.push("");
  var wrappedTitle = wrapText(metadata.title, 0, TITLE_WIDTH);
  for (var i=0; i<wrappedTitle.length; ++i) {
    line = blank(PAGE_WIDTH);
    line = insertCentered(wrappedTitle[i], line);
    headerLines.push(line);
  }
  line = blank(PAGE_WIDTH);
  line = insertCentered(metadata.docname, line);
  headerLines.push(line);

  return [{
    type: "raw",
    rendered: headerLines,
  }];
}


///// MAIN MATTER /////

function renderFigure(block) {
  var lines = block.text.split("\n");

  var width = 0;
  lines.map(function(line) {
    width = (line.length > width)? line.length : width;
  });

  // Center the figure
  var pad = centerPad(PAGE_WIDTH, width);
  lines = lines.map(function(line) { return pad + line; });

  // Add the title
  var title = "Figure "+ block.number + ": " + block.title;
  var titleLines = wrapText(title, 0, TITLE_WIDTH).map(function(line) {
    return centerPad(PAGE_WIDTH, line.length) + line;
  })
  lines.push(""); // Blank line before title
  lines = lines.concat(titleLines);

  return lines;
}

function renderTable(block) {
  var data = block.data;
  if (data.length == 0) {
    throw "Empty table";
  }

  // Compute column widths and alignments
  var tableWidth = 2; // For "| " opener
  var colWidth = [];
  var colAlign = [];
  for (j in data[0].cells) {
    var width = 0;
    var align = null;
    for (i in data) {
      if (data[i].cells[j].length > width) {
        width = data[i].cells[j].length
      }

      // Take first stated alignment
      align = align || data[i].flags[j].align;
    }
    // Default alignment is "left"
    align = align || "left";

    tableWidth += width + 2; // For " |" closer
    colWidth.push(width);
    colAlign.push(align);
  }

  // TODO Wrapping
  if (tableWidth > PAGE_WIDTH) {
    throw "Table width exceeds page width";
  }
  var tablePad = centerPad(PAGE_WIDTH, tableWidth);

  var divider = tablePad + "+";
  colWidth.map(function(width) {
    divider += repeat("-", width+2) + "+";
  });

  // Write out table rows
  var rows = [];
  rows.push(divider);
  for (i in data) {
    var row = tablePad + "|";
    var header = false;
    for (j in data[i].cells) {
      header = header || data[i].flags[j].header;

      var text = data[i].cells[j];
      var lpad = centerPad(colWidth[j], text.length);
      var rpad = blank(colWidth[j] - text.length - lpad.length);
      switch (colAlign[j]) {
        case "left":   row += " " + text + lpad + rpad; break;
        case "right":  row += " " + lpad + rpad + text; break;
        case "center": row += " " + lpad + text + rpad; break;
        default: throw("Unaligned column");
      }
      row += " |";
    }
    rows.push(row);

    if (header) {
      rows.push(divider);
    }
  }
  rows.push(divider);

  // Add the title
  var title = "Figure "+ block.number + ": " + block.title;
  var titleLines = wrapText(title, 0, TITLE_WIDTH).map(function(line) {
    return centerPad(PAGE_WIDTH, line.length) + line;
  })
  rows.push(""); // Blank line before title
  rows = rows.concat(titleLines);

  return rows;
}

function renderList(block) {
  var lines = [];

  if (!block.items) {
    return lines;
  }

  var counter = 0;
  for (i in block.items) {
    counter += 1;
    var subLines = renderListInner(block.items[i], PARAGRAPH_INDENT, block.ordered, counter);
    lines = lines.concat(subLines)
  }

  return lines;
}

function renderListInner(block, indent, ordered, counter) {
  var lines = [];
  var label = (ordered)? (counter + ".") : "*";
  if (block.text) {
    var wrappedContent = wrapText(block.text, indent + label.length + 1, PAGE_WIDTH);
    wrappedContent[0] = blank(indent) + label +
                        wrappedContent[0].substring(indent + label.length);
    lines = lines.concat(wrappedContent);
  } else {
    lines.push([blank(indent) + label]);
  }

  var counter = 0;
  if (block.items) {
    for (i in block.items) {
      counter += 1;
      var subLines = renderListInner(block.items[i], indent + label.length + 1,
                                     block.ordered, counter);
      lines = lines.concat(subLines);
    }
  }

  return lines;
}

function block2txt(block) {
  switch (block.type) {
    case "section":
      var sectionNumber = (block.number)? block.number + ". " : "";
      var wrappedTitle = wrapText(block.text, sectionNumber.length, PAGE_WIDTH);
      wrappedTitle[0] = sectionNumber +
                        wrappedTitle[0].substring(sectionNumber.length);
      return wrappedTitle;

    case "paragraph":
      return wrapText(block.text, PARAGRAPH_INDENT, PAGE_WIDTH);

    case "blockquote":
      return wrapText(block.text, BLOCKQUOTE_INDENT, PAGE_WIDTH);

    case "figure":
      return renderFigure(block);

    case "table":
      return renderTable(block);

    // TODO: Provide multiple blocks so that there can be page breaks
    // between bullet points
    case "listnode":
      return renderList(block);

    default:
      throw "Unsupported block type: " + block.type;
  }
}

///// REFERENCES /////

// The gathering steps are defined in common.js.  We only do rendering here.

function replaceReferences(AST, anchors, refs) {
  function replaceInBlock(block) {
    if (block.text) {
      var matches = block.text.match(/\[[^\]]*\]\([^)]+\)/g);
      for (i in matches) {
        text = matches[i].replace(/\]\([^)]+\)$/, "").replace(/^\[/, "");
        tag = matches[i].replace(/^\[[^\]]*\]\(/, "").replace(/\)$/, "");

        var replacement = "";
        if (tag in anchors) {
          replacement = anchors[tag];
        } else if (tag in refs.map) {
          if (text.length > 0) {
            replacement = text + " [" + refs.map[tag] + "]";
          } else {
            replacement = "[" + refs.map[tag] + "]";
          }
        } else {
          throw "Unknown reference: "+ tag;
        }
        block.text = block.text.replace(matches[i], replacement);
      }
    }

    if (block.items) {
      block.items.map(replaceInBlock);
    }
  }

  AST.abstract.map(replaceInBlock);
  AST.notes.map(replaceInBlock);
  AST.middle.map(replaceInBlock);
  AST.back.map(replaceInBlock);
}

function renderReferences(sectionNumber, refs) {
  var blocks = [{
    type: "section",
    text: "References",
    number: sectionNumber,
    level: 1,
  }]

  blocks.push({
    type: "section",
    text: "Normative References",
    number: sectionNumber + ".1",
    level: 2,
  });
  for (var i=0; i<refs.normative.length; ++i) {
    var refText = "["+ (i+1) +"] ";
    if (isIETFReference(refs.normative[i])) {
      var info = IETFReferenceInfo(refs.normative[i]);
      refText += (info.series == "RFC")? ("RFC " + info.value) : info.value;
               + " <"+ info.uri +">";
    } else {
      refText += refs.normative[i];
    }

    // XXX This will not render well for >1 line references
    blocks.push({type: "paragraph", text: refText});
  }

  blocks.push({
    type: "section",
    text: "Informative References",
    number: sectionNumber + ".2",
    level: 2,
  });
  for (var i=0; i<refs.informative.length; ++i) {
    var refText = "["+ (refs.normative.length + i + 1) +"] ";
    if (isIETFReference(refs.normative[i])) {
      var info = IETFReferenceInfo(refs.normative[i]);
      refText += (info.series == "RFC")? ("RFC " + info.value) : info.value;
               + " <"+ info.uri +">";
    } else {
      refText += refs.informative[i];
    }

    // XXX This will not render well for >1 line references
    blocks.push({type: "paragraph", text: refText});
  }

  return blocks;
}

function prepareBoilerplate(date) {
  var boilerplate = BOILERPLATE_TRUST200902.slice();

  // Replace the expiry date
  boilerplate[3][0] = boilerplate[3][0].replace(/EXPIRY_DATE/, renderDate(addSixMonths(date)));

  // Replace the copyright year
  boilerplate[4][2] = boilerplate[4][2].replace(/CURRENT_YEAR/, date.getFullYear());

  return boilerplate.map(function(x) {
    return { type: "raw", rendered: x };
  });
}

function renderAuthorsAddresses(authors) {
  var blocks = [{
    type: "raw",
    rendered: ["Authors' Addresses"],
  }];

  authors.map(function(author) {
    if (!author.name) { throw "Author provided without a name"; }
    if (!author.org)  { throw "Author provided without an org"; }

    var lines = [
      author.name,
      author.org
    ];
    if (author.email) {
      lines.push("Email: "+ author.email);
    }
    // TODO: Other forms of contact

    blocks.push({
      type: "raw",
      rendered: lines.map(function(x) { return blank(PARAGRAPH_INDENT) + x; }),
    });
  });

  return blocks;
}

// Very simple pagination algorithm.  Each rendered block is a unit.
// No other widow/orphan control or binding.  The "+1" are sprinkled
// about to account for blank lines that the serializer puts between
// blocks.
//
// Produces an array of arrays of blocks, where each entry in the
// top-level array represents a page in terms of the blocks that will
// be rendered on that page.
//
// This method assumes that each block has already been rendered, i.e.,
// that block.rendered is an array of lines representing the block.
function paginate(blocks) {
  var pages = [];
  var currPageLines = 0;
  var pageNumber = 1;
  var currPage = { number: pageNumber, blocks: [] };
  blocks.map(function(block) {
    if (currPageLines + block.rendered.length + 1 > PAGE_HEIGHT) {
      pages.push(currPage);
      pageNumber += 1;
      currPage = { number: pageNumber, blocks: [] };
      currPageLines = 0;
    }

    currPage.blocks.push(block);
    currPageLines += block.rendered.length + 1;
  });
  pages.push(currPage);
  return pages;
}

function renderTOC(pages) {
  var sectionMap = [];
  pages.map(function(page) {
    page.blocks.map(function(block) {
      if (block.type == "section") {
        sectionMap.push({
          number: block.number,
          text: block.text,
          page: page.number,
        });
      }
    });
  });

  var tocBlocks = [{
    type: "raw",
    rendered: ["Table of Contents"],
  }];
  var dotsLine = ". ".repeat(PAGE_WIDTH).substr(0, PAGE_WIDTH - 3);
  sectionMap.map(function(entry) {
    var text = entry.number + ". " + entry.text;
    var label = entry.number + ". ";
    var wrappedText = wrapText(entry.text, PARAGRAPH_INDENT + label.length,
                                           PAGE_WIDTH - 2*TOC_NUMBER_WIDTH);
    wrappedText[0] = insertLeftAligned(blank(PARAGRAPH_INDENT) + label, wrappedText[0]);
    var lastLine = wrappedText.pop();
    lastLine = insertLeftAligned(lastLine + " ", dotsLine);
    lastLine = insertRightAligned(" " + entry.page.toString(), lastLine);
    wrappedText.push(lastLine)

    tocBlocks.push({
      type: "raw",
      rendered: wrappedText,
    });
  });

  return tocBlocks;
}

// HDR: Internet-Draft                    ACME                    September 2014
function pageHeader(metadata) {
  var abbrev = metadata.abbrev || metadata.title;
  var header = blank(PAGE_WIDTH);
  header = insertCentered(abbrev, header);
  header = insertLeftAligned("Internet-Draft ", header);
  header = insertRightAligned(renderHeaderDate(metadata.date), header);
  return header;
}

// To finish this template you will want to:
//   insertRightAligned("[Page "+num+"]", footerTemplate);
// FTR: Barnes & Rescorla         Expires March 5, 2015                 [Page 1]
function pageFooterTemplate(metadata) {
  var authorName;
  if (metadata.author.length == 1) {
    authorName = metadata.author[0].ins.replace(/^[A-Z.]*\s+/, "");
  } else if (metadata.author.length == 2) {
    var lastName1 = metadata.author[0].ins.replace(/^[A-Z.]*\s+/, "");
    var lastName2 = metadata.author[1].ins.replace(/^[A-Z.]*\s+/, "");
    authorName = lastName1 + " & " + lastName2;
  } else if (metadata.author.length > 2) {
    authorName = metadata.author[0].ins.replace(/^[A-Z.]*\s+/, "") + ", et al.";
  } else {
    throw "No author provided";
  }

  var expiry = addSixMonths(metadata.date);

  var footer = blank(PAGE_WIDTH);
  footer = insertLeftAligned(authorName, footer);
  footer = insertCentered("Expires "+renderDate(expiry), footer);
  return footer;
}

window.toTXT = function(AST) {
  // TODO Validate incoming object
  AST.front.date = AST.front.date || (new Date());

  // References
  // Extract references from all blocks
  var anchors = gatherAnchors(AST);
  var refs = gatherReferences(AST, anchors);
  replaceReferences(AST, anchors, refs);

  var maxSectionNumber = 0;
  AST.middle.filter(function(x) { return x.type == "section" && x.level == 1; })
            .map(function(x) { if (x.number > maxSectionNumber) { maxSectionNumber = x.number; } });
  maxSectionNumber = parseInt(maxSectionNumber);
  var referenceAST = renderReferences(maxSectionNumber+1, refs);
  var middle = AST.middle.slice().concat(referenceAST);


  // Preliminary render and paginate
  // Sequence of rendering:
  // - Front              \
  // - Abstract           |_ Front half
  // - Boilerplate        |
  // - Notes              /
  // - TOC
  // - Main (+References) \
  // - Back               |- Back half
  // - Authors' Addresses /
  //
  // We will then use the TOC length to adjust the page
  // numbers in the back half.
  function render(block) {
    block.rendered = block2txt(block);
  }
  AST.abstract.map(render);
  AST.notes.map(render);
  middle.map(render);
  AST.back.map(render);
  var boilerplateBlocks = prepareBoilerplate(AST.front.date);
  var authorBlocks = renderAuthorsAddresses(AST.front.author);
  var frontBlocks = renderFrontMatter(AST.front)
                    .concat(AST.abstract)
                    .concat(boilerplateBlocks)
                    .concat(AST.notes);
  var middleBackBlocks = middle.concat(AST.back)
                               .concat(authorBlocks);
  var frontPages = paginate(frontBlocks);
  var middleBackPages = paginate(middleBackBlocks);

  // Section map and TOC
  var tocBlocks = renderTOC(middleBackPages);
  var frontPageCount = paginate(frontBlocks.concat(tocBlocks)).length;
  middleBackPages.map(function(page) {
    page.number += frontPageCount;
  });
  frontBlocks = frontBlocks.concat(renderTOC(middleBackPages));
  frontPages = paginate(frontBlocks);

  // Render pages, with header and footer
  // - Header line
  // - 2x blank lines
  // * block + blank line
  // * blank lines
  // - Footer line
  //
  // So pages will actually be PAGE_HEIGHT + 5 lines tall
  var docHeader = pageHeader(AST.front);
  var footerTemplate = pageFooterTemplate(AST.front);
  var firstPage = true;
  function renderPage(page) {
    var header = (firstPage)? "" : docHeader;
    firstPage = false;

    var lines = [header, "",""];
    page.blocks.map(function(block) {
      lines = lines.concat(block.rendered);
      lines.push("");
    });
    while (lines.length < PAGE_HEIGHT - 1) {
      lines.push("");
    }
    lines.push(insertRightAligned("[Page "+ page.number +"]", footerTemplate));
    return lines.join("\n")+"\n";
  }
  var renderedPages = frontPages.concat(middleBackPages)
                                .map(renderPage);
  return renderedPages.join(PAGE_BREAK);
}

})();
