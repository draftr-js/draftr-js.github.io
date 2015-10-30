// TODO Documentation

(function() {

var HTML_STUB = "<body>\n</body>";

// <tag>text</tag>
function appendSimpleChild(doc, node, tag, text) {
  if (!text) {
    return;
  }

  var element = doc.createElement(tag);
  element.innerHTML = text;
  node.appendChild(element);
}

// front = (title , author+ , date , area* , workgroup* , keyword* , abstract? , note*)
function appendFront(xml, metadata, abstractBlocks, notesBlocks) {
  var body = xml.documentElement;

  // Add title
  var title = xml.createElement("h1");
  if (metadata.abbrev) {
    title.setAttribute("abbrev", metadata.abbrev);
  }
  title.innerHTML = metadata.title;
  body.appendChild(title);


  // Add authors
  var authors = xml.createElement("p");
  for (i in metadata.author) {
    var data = metadata.author[i];
    var authorString = data.name;

    // Organization
    if (data.org) {
      authorString += " ("+ data.org +")";
    }

    if ((i == metadata.author.length - 1) && (i > 0)) {
      authorString = "and " + authorString;
    } else if (metadata.author.length > 1) {
      authorString = authorString + ", ";
    }

    authors.innerHTML += authorString;
  }
  body.appendChild(authors);

  // Add date
  var date = xml.createElement("p");
  date.innerHTML = months[metadata.date.getMonth()] + " " +
                   metadata.date.getDate() + ", " +
                   metadata.date.getFullYear();
  body.appendChild(date);

  // TODO Area, workgroup, keyword (?)

  // Add abstract
  if (abstractBlocks && abstractBlocks.length > 0) {
    for (var i in abstractBlocks) {
      appendBlock(xml, body, abstractBlocks[i]);
    }
  }

  // Add notes
  if (notesBlocks && notesBlocks.length > 0) {
    for (var i in notesBlocks) {
      appendBlock(xml, body, notesBlocks[i]);
    }
  }
}

function appendMiddle(xml, blocks) {
  var body = xml.documentElement;
  for (i in blocks) {
    appendBlock(xml, body, blocks[i]);
  }
}

function appendBack(xml, references, blocks) {
  var body = xml.documentElement;

  // First add the references
  /*
  // TODO
  if (references.normative && references.normative.length > 0) {
    var refsElement = renderReferences(xml, references.normative);
    refsElement.setAttribute("title", "Normative References");
    back.appendChild(refsElement);
  }
  if (references.informative && references.informative.length > 0) {
    var refsElement = renderReferences(xml, references.informative);
    refsElement.setAttribute("title", "Informative References");
    back.appendChild(refsElement);
  }
  */

  // Then add the sections, as for <middle>
  for (i in blocks) {
    appendBlock(xml, xml.documentElement, blocks[i]);
  }
}

// This function will handle simple block types, i.e., the ones that are totally
// described by a block object, i.e., not "section".
function appendBlock(xml, node, block) {
  switch (block.type) {
    case "paragraph":
      var p = xml.createElement("p");
      p.innerHTML = block.text;
      node.appendChild(p);
      break;

    case "blockquote":
      var blockquote = xml.createElement("blockquote");
      blockquote.innerHTML = block.text;
      node.appendChild(blockquote);
      break;

    case "section":
      if (block.anchors && block.anchors.length > 0) {
        var anchor = xml.createElement("a");
        anchor.setAttribute("name", block.anchors[0]);
        node.appendChild(anchor);
      }
      var title = block.text;
      if (block.number) {
        title = block.number + ". " + title;
      }
      var level = block.level || 1;
      var tagName = "h" + (level + 1);
      var hN = xml.createElement(tagName);
      hN.innerHTML = title;
      node.appendChild(hN);
      break;

    case "figure":
      appendFigure(xml, node, block);
      break;

    case "listnode":
      appendList(xml, node, block);
      break;

    case "table":
      appendTable(xml, node, block);
      break;

    default:
      throw "Unknown block type: " + block.type;
  }
}

function appendFigure(xml, node, block) {
  var figure = xml.createElement("figure");

  // The figure itself
  var pre = xml.createElement("pre");
  pre.setAttribute("style", "background: #ccc; border: 1px solid #999; border-radius: 4px;");
  var cdata = xml.createTextNode(block.text);
  pre.appendChild(cdata);
  figure.appendChild(pre);

  // Anchor
  if (block.anchors && block.anchors.length > 0) {
    var anchor = xml.createElement("a");
    anchor.setAttribute("name", block.anchors[0]);
    figure.appendChild(anchor);
  }

  // Title
  if (block.number && block.title) {
    var figcaption = xml.createElement("figcaption");
    figcaption.innerHTML = "Figure "+ block.number +". "+ block.title;
    figure.appendChild(figcaption);
  }
  node.appendChild(figure);
  return;
}

function appendTable(xml, node, block) {
  var table = xml.createElement("table");

  // Add column headers <tr><th>...</tr>
  var data = block.data;
  if (data.length == 0) {
    throw "Empty table";
  }
  var colAlign = [];
  var tr = xml.createElement("tr");
  for (j in data[0].cells) {
    var th = xml.createElement("th");

    // Take first stated alignment, defaulting to "left"
    var align = null;
    for (i in data) {
      align = align || data[i].flags[j].align;
    }
    align = align || "left";
    th.setAttribute("align", align);
    colAlign.push(align);

    th.innerHTML = data[0].cells[j];
    tr.appendChild(th);
  }
  table.appendChild(tr);

  // Add cells in <tr><td>...</tr>
  for (var i=1; i<data.length; ++i) {
    var tr = xml.createElement("tr");
    for (j in data[i].cells) {
      var td = xml.createElement("td");
      td.innerHTML = data[i].cells[j];
      td.setAttribute("align", colAlign[j]);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }

  // Caption
  if (block.number && block.title) {
    var figcaption = xml.createElement("caption");
    figcaption.innerHTML = "Figure "+ block.number +". "+ block.title;
    table.appendChild(figcaption);
  }

  node.appendChild(table);

  // Anchor is appended after <table>, if present
  if (block.anchors && block.anchors.length > 0) {
    var anchor = xml.createElement("a");
    anchor.setAttribute("name", block.anchors[0]);
    node.appendChild(anchor);
  }
}

function appendList(xml, node, block) {
  if (block.text) {
    node.appendChild(xml.createTextNode(block.text));
  }

  if (!block.items || block.items.length == 0) {
    return;
  }

  var listTag = (block.ordered)? "ol" : "ul";
  var list = xml.createElement(listTag);

  for (i in block.items) {
    var li = xml.createElement("li");
    appendList(xml, li, block.items[i]);
    list.appendChild(li);
  }
  node.appendChild(list);
}

// HTTP URIs aren't acceptable as targets/anchors, so transform them
function httpAnchor(tag) {
  return tag.replace(/[:\/]+/g, "-");
}

function replaceReferences(AST, anchors, refs) {
  function replaceInBlock(block) {
    if (block.text) {
      var matches = block.text.match(/\[[^\]]*\]\([^)]+\)/g);
      for (i in matches) {
        text = matches[i].replace(/\]\([^)]+\)$/, "").replace(/^\[/, "");
        tag = matches[i].replace(/^\[[^\]]*\]\(/, "").replace(/\)$/, "");

        if (!(tag in anchors || tag in refs.map)) {
          throw "Unknown reference: "+ tag;
        }

        if (isHTTPReference(tag)) {
          tag = httpAnchor(tag);
        }

        var xref = "<xref target='"+ tag +"'>"+ text +"</xref>";
        block.text = block.text.replace(matches[i], xref);
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

function renderReferences(xml, tags) {
  var references = xml.createElement("references");

  for (i in tags) {
    var tag = tags[i];
    var reference = xml.createElement("reference");

    if (isHTTPReference(tag)) {
      tag = httpAnchor(tag);
    }
    reference.setAttribute("anchor", tag);

    // <front> requires <title>, <author>, and <date>,
    // but we don't have them.  So we fill in blanks.
    var front = xml.createElement("front");
    appendSimpleChild(xml, front, "title", " ");
    appendSimpleChild(xml, front, "author", " ");
    var date = xml.createElement("date");
    //date.setAttribute("year", "2100");
    //date.setAttribute("month", "April");
    //date.setAttribute("day", "1");
    front.appendChild(date);
    reference.appendChild(front);

    if (isIETFReference(tag)) {
      var info = IETFReferenceInfo(tag);
      reference.setAttribute("target", info.uri);
      var seriesInfo = xml.createElement("seriesInfo");
      seriesInfo.setAttribute("name", info.series);
      seriesInfo.setAttribute("value", info.value);
      reference.appendChild(seriesInfo);
    } else if (isHTTPReference(tag)) {
      // Render as a URI
      reference.setAttribute("target", tag);
    } else {
      // Must have come from the metadata
      // TODO
    }

    references.appendChild(reference);
  }

  return references;
}

window.toHTML = function(AST) {
  // TODO Validate incoming object
  // TODO Move this to fromFOO
  AST.front.date = AST.front.date || (new Date());
  AST.front.abbrev = AST.front.abbrev || AST.front.title;

  var parser = new DOMParser();
  var html = parser.parseFromString(HTML_STUB, "text/xml"); // Actually html

  var anchors = gatherAnchors(AST);
  var refs = gatherReferences(AST, anchors);
  /*
  replaceReferences(AST, anchors, refs);
  */

  appendFront(html, AST.front, AST.abstract.slice(), AST.notes.slice());
  appendMiddle(html, AST.middle.slice());
  appendBack(html, refs, AST.back);


  // Assemble the document
  var serializer = new XMLSerializer();
  var serialized = serializer.serializeToString(html);
  return vkbeautify.xml(serialized, 2);
}

})();
