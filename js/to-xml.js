// TODO Documentation

(function() {

var XML_STUB = "<?xml version='1.0' encoding='UTF-8'?>\n<!DOCTYPE rfc SYSTEM 'rfc2629.dtd' []>\n<rfc/>"

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
  var middle = xml.createElement("middle");

  // It is expected that section2xml will make the blocks
  // array shorter (using blocks.shift()).
  while (blocks.length > 0) {
    middle.appendChild(section2xml(xml, blocks));
  }

  xml.documentElement.appendChild(middle);
}

function appendBack(xml, references, blocks) {
  var back = xml.createElement("back");

  // First add the references
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

  // Then add the sections, as for <middle>
  while (blocks.length > 0) {
    back.appendChild(section2xml(xml, blocks));
  }

  xml.documentElement.appendChild(back);
}

function section2xml(xml, blocks) {
  var sectionBlock = blocks.shift();
  if (sectionBlock.type != "section") {
    throw "Unexpected non-section block";
  }

  var section = xml.createElement("section");
  section.setAttribute("title", sectionBlock.text);
  if (sectionBlock.anchors && sectionBlock.anchors.length > 0) {
    section.setAttribute("anchor", sectionBlock.anchors[0]);
  }

  while (blocks.length > 0 && blocks[0].type != "section") {
    var newElement;
    if (blocks[0].type == "section") {
      if (blocks[0].level > sectionBlock.level) {
        newElement = section2xml(xml, blocks);
      } else {
        break;
      }
    } else {
      newElement = block2xml(xml, blocks.shift());
    }
    section.appendChild(newElement);
  }
  return section;
}

// This function will handle simple block types, i.e., the ones that are totally
// described by a block object, i.e., not "section".
function block2xml(xml, block) {
  switch (block.type) {
    case "paragraph":
      var t = xml.createElement("t");
      t.innerHTML = block.text;
      return t;

    case "table":
      return renderTable(xml, block);

    case "figure":
      return renderFigure(xml, block);

    case "listnode":
      return renderList(xml, block);

    case "blockquote":
      return renderBlockquote(xml, block);

    case "section":
      throw "Section passed to block2xml";

    default:
      throw "Unknown block type: " + block.type;
  }
}

function renderFigure(xml, block) {
  var figure = xml.createElement("figure");

  // XXX: Set other attributes on texttable?
  //      (align=center, alt="", suppress-title=false)
  if (block.anchors && block.anchors.length > 0) {
    figure.setAttribute("anchor", block.anchors[0]);
  }
  if (block.title) {
    figure.setAttribute("title", block.title);
  }

  // We center-justify the figure, as we do for TXT format
  var lines = block.text.split("\n");
  var width = 0;
  lines.map(function(line) {
    width = (line.length > width)? line.length : width;
  });
  var pad = centerPad(PAGE_WIDTH, width);
  var centered = lines.map(function(line) { return pad + line; })
                      .join("\n")

  var artwork = xml.createElement("artwork");
  artwork.appendChild(xml.createCDATASection(centered));
  figure.appendChild(artwork);
  return figure;
}

function renderTable(xml, block) {
  var texttable = xml.createElement("texttable");

  // XXX: Set other attributes on texttable?
  //      (align=center, style=full, suppress-title=false)
  if (block.anchors && block.anchors.length > 0) {
    texttable.setAttribute("anchor", block.anchors[0]);
  }
  if (block.title) {
    texttable.setAttribute("title", block.title);
  }

  // Add column headers <ttcol>
  var data = block.data;
  if (data.length == 0) {
    throw "Empty table";
  }
  for (j in data[0].cells) {
    var ttcol = xml.createElement("ttcol");

    // Take first stated alignment, defaulting to "left"
    var align = null;
    for (i in data) {
      align = align || data[i].flags[j].align;
    }
    if (align) {
      ttcol.setAttribute("align", align);
    }

    ttcol.innerHTML = data[0].cells[j];
    texttable.appendChild(ttcol);
  }

  // Add cells in <c>
  for (var i=1; i<data.length; ++i) {
    for (j in data[i].cells) {
      var c = xml.createElement("c");
      c.innerHTML = data[i].cells[j];
      texttable.appendChild(c);
    }
  }

  return texttable;
}

function renderList(xml, block) {
  var t = xml.createElement("t");

  if (block.text) {
    t.appendChild(xml.createTextNode(block.text));
  }

  if (!block.items || block.items.length == 0) {
    return t;
  }

  var list = xml.createElement("list");

  if (block.ordered) {
    list.setAttribute("style", "symbols");
  } else {
    list.setAttribute("style", "numbers");
  }

  for (i in block.items) {
    list.appendChild(renderList(xml, block.items[i]));
  }

  t.appendChild(list)
  return t;
}

function renderBlockquote(xml, block) {
  // Blockquotes are rendered with <list style="empty">
  var tOuter = xml.createElement("t");
  var list = xml.createElement("list");
  list.setAttribute("style", "empty");

  var tInner = xml.createElement("t");
  tInner.innerHTML = block.text;

  list.appendChild(tInner);
  tOuter.appendChild(list);
  return tOuter;
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

window.toXML = function(AST) {
  // TODO Validate incoming object
  // TODO Move this to fromFOO
  AST.front.date = AST.front.date || (new Date());
  AST.front.abbrev = AST.front.abbrev || AST.front.title;

  var parser = new DOMParser();
  var xml = parser.parseFromString(XML_STUB, "text/xml");

  var anchors = gatherAnchors(AST);
  var refs = gatherReferences(AST, anchors);
  replaceReferences(AST, anchors, refs);

  appendFront(xml, AST.front, AST.abstract.slice(), AST.notes.slice());
  appendMiddle(xml, AST.middle.slice());
  appendBack(xml, refs, AST.back.slice());

  // Assemble the document
  var serializer = new XMLSerializer();
  var serialized = serializer.serializeToString(xml);
  return vkbeautify.xml(serialized, 2);
}

})();
