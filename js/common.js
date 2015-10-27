// Common utility data that all JS files can assume.

// --------------------------------------------------
var months = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"];


// --------------------------------------------------
// We share centering code so that renderers can center figures if they want.
var PAGE_WIDTH = 72;

// XXX: Surely there's a better way?
function repeat(str, n) {
  var ret = "";
  for (var i=0; i<n; ++i) { ret += str; }
  return ret;
}

function blank(n) {
  return repeat(" ", n);
}

function centerPad(outer, inner) {
  return blank(Math.floor((outer - inner)/2));
}

// --------------------------------------------------
// The fromFOO functions leave references in-situ, in markdown format.  So we
// share the code for gathering anchors and referecnes, but leave the
// replacement of these references to renderers.

function isRFCReference(tag) {
  return tag.match(/^RFC\d{1,4}$/);
}

function isIDReference(tag) {
  return tag.match(/^I-D.[\w-]+$/)
}

function isIETFReference(tag) {
  return isRFCReference(tag) || isIDReference(tag);
}

const IETF_LINK_TEMPLATE = "https://tools.ietf.org/html/";

function IETFReferenceInfo(tag) {
  if (isRFCReference(tag)) {
    var rfcNumber = tag.replace(/^RFC/, "");
    return {
      series: "RFC",
      value: rfcNumber,
      uri: IETF_LINK_TEMPLATE +"rfc"+ rfcNumber,
    };
  } else if (isIDReference(tag)) {
    var draftName = tag.replace(/^I-D./, "draft-");
    return {
      series: "Internet-Draft",
      value: draftName,
      uri: IETF_LINK_TEMPLATE + draftName,
    }
  } else {
    throw "Can't convert a non-IETF reference to an IETF URI";
  }
}

function isHTTPReference(tag) {
  return tag.match(/^https?:\/\//);
}

// Returns map{ anchor -> name }, for sections, figures, and tables.  References
// to these things should be of the form [](anchor), and the renderer should
// fill in the name from here.
function gatherAnchors(AST) {
  var refs = {};

  function gatherFromBlock(block) {
    var label = "";
    switch (block.type) {
      case "section": label = "Section " + block.number; break;
      case "figure" : label = "Figure "  + block.number; break;
      case "table"  : label = "Table "   + block.number; break;
      default: return;
    }

    for (i in block.anchors) {
      refs[block.anchors[i]] = label;
    }
  }

  AST.abstract.map(gatherFromBlock);
  AST.notes.map(gatherFromBlock);
  AST.middle.map(gatherFromBlock);
  AST.back.map(gatherFromBlock);
  return refs;
}

// Gathers referenced tags from inside the text of an AST, using the standard
// markdown form [text](tag).  References are also taken from the metadata
// provided at the top of the file.
//
// References are informative by default, and promoted to normative if they are
// found in AST.front.normative.
//
// Any references that are not used in the text are omitted, even if they are
// defined in the header.
//
// Returns:
// {
//  normative: [tags],
//  informative: [tags],
//  map: { tag -> referenceNumber }
// }
function gatherReferences(AST, anchors) {
  var refs = {};

  function gatherFromBlock(block) {
    if (!block.text) { return; }

    // For some reason, this doesn't match the final close-paren
    var matches = block.text.match(/\[[^\]]*\]\([^)]+\)/g);
    for (i in matches) {
      tag = matches[i].replace(/\[[^\]]*\]\(/, "").replace(/\)/, "");
      refs[tag] = true;
    }

    if (block.items) {
      block.items.map(gatherFromBlock);
    }
  }

  AST.abstract.map(gatherFromBlock);
  AST.notes.map(gatherFromBlock);
  AST.middle.map(gatherFromBlock);
  AST.back.map(gatherFromBlock);

  // Filter out things that are just internal references
  var refList = Object.keys(refs).filter(function(tag) {
    return (tag in AST.front.normative) || (tag in AST.front.informative) ||
           isIETFReference(tag) || isHTTPReference(tag);
  });
  var normative = refList.filter(function(tag) { return (tag in AST.front.normative); }).sort();
  var informative = refList.filter(function(tag) { return !(tag in AST.front.normative); }).sort();

  var refMap = {};
  for (var i=0; i < normative.length; ++i) {
    refMap[normative[i]] = i+1;
  }
  for (var i=0; i < informative.length; ++i) {
    refMap[informative[i]] = normative.length + i + 1;
  }

  return {
    normative: normative,
    informative: informative,
    map: refMap,
  };
}


