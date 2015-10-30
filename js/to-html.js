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
  xml.documentElement.setAttribute("ipr", "trust200902");
  xml.documentElement.setAttribute("docName", metadata.docname);
  xml.documentElement.setAttribute("category", metadata.cat);

  var front = xml.createElement("front");

  // Add title
  var title = xml.createElement("title");
  if (metadata.abbrev) {
    title.setAttribute("abbrev", metadata.abbrev);
  }
  title.innerHTML = metadata.title;
  front.appendChild(title);

  // Add authors
  for (i in metadata.author) {
    var data = metadata.author[i];
    var author = xml.createElement("author");

    if (data.name) {
      author.setAttribute("fullname", data.name);
    }
    if (data.ins && data.ins.match(/^[A-Z. ]+ /)) {
      var initials = data.ins.match(/^[A-Z. ]+ /)[0].trim();
      var surname = data.ins.replace(/^[A-Z. ]+ /, "").trim();
      author.setAttribute("initials", initials);
      author.setAttribute("surname", surname);
    }
    if (data.role) {
      author.setAttribute("role", data.role);
    }

    // Organization
    if (data.org) {
      appendSimpleChild(xml, author, "organization", data.org);

    }

    // TODO: Handle other address types
    if (data.country || data.phone || data.facsimile || data.email || data.uri) {
      var address = xml.createElement("address");
      if (data.country) {
        var postal = xml.createElement("postal");
        for (var i in data.street) {
          appendSimpleChild(xml, postal, "street", data.street[i]);
        }

        appendSimpleChild(xml, postal, "city", data.city);
        appendSimpleChild(xml, postal, "region", data.region);
        appendSimpleChild(xml, postal, "code", data.code);
        appendSimpleChild(xml, postal, "country", data.country);
        address.appendChild(postal);
      }

      appendSimpleChild(xml, address, "phone", data.phone);
      appendSimpleChild(xml, address, "facsimile", data.facsimile);
      appendSimpleChild(xml, address, "email", data.email);
      appendSimpleChild(xml, address, "uri", data.uri);
      author.appendChild(address);
    }

    front.appendChild(author);
  }

  // Add date
  var date = xml.createElement("date");
  date.setAttribute("year", metadata.date.getFullYear());
  date.setAttribute("month", months[metadata.date.getMonth()]);
  date.setAttribute("day", metadata.date.getDate());
  front.appendChild(date);

  // TODO Area, workgroup, keyword (?)

  // Add abstract
  if (abstractBlocks && abstractBlocks.length > 0) {
    var abstract = xml.createElement("abstract");
    for (var i in abstractBlocks) {
      if (abstractBlocks[i].type != "paragraph") {
        // XXX fromMD() should not emit a "section" block for the abstract.
        continue;
      }
      abstract.appendChild(block2xml(xml, abstractBlocks[i]));
    }
    front.appendChild(abstract);
  }

  // Add notes
  if (notesBlocks && notesBlocks.length > 0) {
    var note = xml.createElement("note");
    var firstBlock = notesBlocks.shift();
    note.setAttribute("title", firstBlock.text);

    for (var i in notesBlocks) {
      var block = notesBlocks[i];
      if (block.type == "section") {
        front.appendChild(note);
        note = xml.createElement("note");
        note.setAttribute("title", block.text);
      } else {
        note.appendChild(block2xml(xml, block));
      }
    }
    front.appendChild(note);
  }

  xml.documentElement.appendChild(front);
}

function appendMiddle(xml, blocks) {
  while (blocks.length > 0) {
    appendBlock(xml, xml.documentElement, blocks.shift());
  }
}

function appendBack(xml, references, blocks) {
  // First add the references
  /*
  // XXX
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
  while (blocks.length > 0) {
    appendBlock(xml, xml.documentElement, blocks.shift());
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
      var tagName = "h" + (block.level + 1);
      var hN = xml.createElement(tagName);
      hN.innerHTML = block.number + ". " + block.text;
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

  /*
  var anchors = gatherAnchors(AST);
  var refs = gatherReferences(AST, anchors);
  replaceReferences(AST, anchors, refs);
  */

  // Assemble and add the <front> element
  //XXX appendFront(xml, AST.front, AST.abstract, AST.notes);

  var middle = AST.middle.slice();
  appendMiddle(html, AST.middle);

  //XXX var back = AST.back.slice();
  //XXX appendBack(xml, refs, AST.back);


  // Assemble the document
  var serializer = new XMLSerializer();
  var serialized = serializer.serializeToString(html);
  return vkbeautify.xml(serialized, 2);
}

})();
