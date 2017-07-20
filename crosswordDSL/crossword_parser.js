// Using UMD (Universal Module Definition), see https://github.com/umdjs/umd, and Jake,
// for a js file to be included as-is in Node code and in browser code.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node. Does not work with strict CommonJS, but
    // only CommonJS-like environments that support module.exports,
    // like Node.
    module.exports = factory();
  } else {
    // Browser globals (root is window)
    root.CrosswordDSL = factory();
  }
}(this, function () {
  // given the DSL, ensure we have all the relevant pieces,
  // and assume there will be subsequent checking to ensure they are valid
  function parseDSL(text){
    var crossword = {
      version      : "standard v1",
       author      : "",
       editor      : "Colin Inman",
      publisher    : "Financial Times",
      copyright    : "2017, Financial Times",
      pubdate      : "today",
     dimensions    : "17x17",
       across      : [],
         down      : [],
       errors      : [],
       originalDSL : text,
    };
    var cluesGrouping;
    var lines = text.split(/\r|\n/);

    for(let line of lines){
      let match;
      // strip out comments
      if (match = /^([^\#]*)\#.*$/.exec(line) ) {
        line = match[1];
      }
      // strip out trailing and leading spaces
      line = line.trim();

      if     ( line === ""   )                                           { /* ignore blank lines */         }
      else if( line === "---")                                           { /* ignore front matter lines */  }
      else if (match = /^(layout|tag|tags|permalink):\s/   .exec(line) ) { /* ignore front matter fields */ }
      else if (match = /^version:?\s+(.+)$/i               .exec(line) ) { crossword.version    = match[1]; }
      else if (match = /^name:?\s+(.+)$/i                  .exec(line) ) { crossword.name       = match[1]; }
      else if (match = /^author:?\s+(.+)$/i                .exec(line) ) { crossword.author     = match[1]; }
      else if (match = /^editor:?\s+(.+)$/i                .exec(line) ) { crossword.editor     = match[1]; }
      else if (match = /^copyright:?\s+(.+)$/i             .exec(line) ) { crossword.copyright  = match[1]; }
      else if (match = /^publisher:?\s+(.+)$/i             .exec(line) ) { crossword.publisher  = match[1]; }
      else if (match = /^pubdate:?\s+(\d{4}\/\d\d\/\d\d)$/i.exec(line) ) { crossword.pubdate    = match[1]; }
      else if (match = /^(?:size|dimensions):?\s+(15x15|17x17)$/i.exec(line) ) { crossword.dimensions = match[1]; }
      else if (match = /^(across|down):?$/i                .exec(line) ) { cluesGrouping        = match[1]; }
      else if (match = /^-\s\((\d+),(\d+)\)\s+(\d+)\.\s+(.+)\s+\(([A-Z,\-*]+|[0-9,-]+)\)$/.exec(line) ) {
        if (! /(across|down)/.test(cluesGrouping)) {
          crossword.errors.push("ERROR: clue specified but no 'across' or 'down' grouping specified");
          break;
        } else {
          let clue = {
            coordinates : [ parseInt(match[1]), parseInt(match[2]) ],
                     id : parseInt(match[3]),
                   body : match[4],
              answerCSV : match[5], // could be in the form of either "A,LIST-OF,WORDS" or "1,4-2,5"
               original : line,
          };
          crossword[cluesGrouping].push(clue);
        }
      } else {
        crossword.errors.push("ERROR: couldn't parse line: " + line);
      }
    };

    return crossword;
  }

  // having found the pieces, check that they encode a valid crossword,
  // creating useful data structures along the way
  function validateAndEmbellishCrossword( crossword ){
    var maxCoord = parseInt(crossword.dimensions.split('x')[0]);
    crossword.maxCoord = maxCoord;
    var grid = new Array( maxCoord * maxCoord ).fill(' ');
    crossword.grid = grid;
    var groupingPrev = {
      across : {
            id : 0,
             x : 0,
             y : 0
          },
        down : {
            id : 0,
             x : 0,
             y : 0
          }
    };
    var knownIds = {};
    crossword.knownIds = knownIds;
    var maxId = 0;

    crossword.answers = {
      across : [],
      down   : []
    };

    // insist on having at least one clue !
    if ( (crossword['across'].length + crossword['down'].length) == 0) {
      crossword.errors.push("Error: no valid clues specified");
    }

    for(let grouping of ['across', 'down']){
      let prev = groupingPrev[grouping];

      for(let clue of crossword[grouping]){
        function clueError(msg){
          crossword.errors.push("Error: " + msg + " in " + grouping + " clue=" + clue.original);
        }

        // check non-zero id
        if (clue.id === 0) {
          clueError("id must be positive");
          break;
        }

        maxId = (clue.id > maxId) ? clue.id : maxId;

        // check id sequence in order
        if (clue.id <= prev.id) {
          clueError("id out of sequence");
          break;
        }

        // check x,y within bounds
        let x = clue.coordinates[0];
        if (x > maxCoord) {
          clueError("x coord too large");
          break;
        }
        let y = clue.coordinates[1];
        if (y > maxCoord) {
          clueError("y coord too large");
          break;
        }

        // check all clues with shared ids start at same coords
        if (clue.id in knownIds) {
          let knownCoords = knownIds[clue.id].coordinates;
          if (   x !== knownCoords[0]
            || y !== knownCoords[1]) {
            clueError("shared id clashes with previous coordinates");
            break;
          }
        } else {
          knownIds[clue.id] = clue;
        }

        {
          // check answer within bounds
          // and unpack the answerCSV

          // convert "ANSWER,PARTS-INTO,NUMBERS" into number csv e.g. "6,5-4,6" (etc)
          if ( /^[A-Z,\-*]+$/.test(clue.answerCSV) ) {
            clue.numericCSV = clue.answerCSV.replace(/[A-Z*]+/g, match => {return match.length.toString() } );
          } else {
            clue.numericCSV = clue.answerCSV;
          }

          // and if the answer is solely *s, replace that with the number csv
          if ( /^[*,\-]+$/.test(clue.answerCSV) ) {
            clue.answerCSV = clue.numericCSV;
          }

          let answerPieces = clue.answerCSV.split(/[,-]/);
          let words = answerPieces.map(p => {
            if (/^[0-9]+$/.test(p)) {
              let pInt = parseInt(p);
              if (pInt == 0) {
                clueError("answer contains a word size of 0");
              }
              return '*'.repeat( pInt );
            } else {
              if (p.length == 0) {
                clueError("answer contains an empty word");
              }
              return p;
            }
          });

          let wordsString = words.join('');
          clue.wordsString = wordsString;
          if (wordsString.length > maxCoord) {
            clueError("answer too long for crossword");
            break;
          }
          crossword.answers[grouping].push(wordsString);

          clue.wordsLengths = words.map(function(w){
            return w.length;
          });
        }

        // check answer + offset within bounds
        if(    (grouping==='across' && (clue.wordsString.length + x - 1 > maxCoord))
          || (grouping==='down'   && (clue.wordsString.length + y - 1 > maxCoord)) ){
          clueError("answer too long for crossword from that coord");
          break;
        }

        {
          // check answer does not clash with previous answers
          let step = (grouping==='across')? 1 : maxCoord;
          for (var i = 0; i < clue.wordsString.length; i++) {
            let pos = (x-1) + (y-1)*maxCoord + i*step;
            if (grid[pos] === ' ') {
              grid[pos] = clue.wordsString[i];
            } else if( grid[pos] !== clue.wordsString[i] ) {
              clueError("letter " + (i+1) + " clashes with previous clues");
              break;
            }
          }
        }

        // update prev
        prev.id = clue.id;
        prev.x  = x;
        prev.y  = y;
      }
    }

    // check we have a contiguous and complete clue id sequence
    if (crossword.errors.length == 0) {
      for (var i = 1; i <= maxId; i++) {
        if (! (i in knownIds)) {
          crossword.errors.push("Error: missing clue with id=" + i);
        }
      }
    }

    // check all the clues across and down are monotonic,
    // i.e. each id starts to the right or down from the previous id
    if (crossword.errors.length == 0) {
      for (var i = 2; i <= maxId; i++) {
        let prevClue = knownIds[i-1];
        let clue 	 = knownIds[i];

        if ( (clue.coordinates[0] + clue.coordinates[1] * maxCoord) <= (prevClue.coordinates[0] + prevClue.coordinates[1] * maxCoord) ) {
          if (clue.coordinates[1] < prevClue.coordinates[1]) {
            crossword.errors.push("Error: clue " + clue.id + " starts above clue " + prevClue.id);
          } else if ((clue.coordinates[1] === prevClue.coordinates[1]) && (clue.coordinates[0] === prevClue.coordinates[0])) {
            crossword.errors.push("Error: clue " + clue.id + " starts at same coords as clue " + prevClue.id);
          } else {
            crossword.errors.push("Error: clue " + clue.id + " starts to the left of clue " + prevClue.id);
          }
          break;
        }
      }
    }

    // check clues start from edge or from an empty cell

    return crossword;
  }

  function getElementByClass(name) {
    return document.getElementsByClassName(name)[0];
  }

  function getElementById(id) {
    return document.getElementById(id);
  }

  // a simple text display of the crossword answers in place
  function generateGridText(crossword) {
    var gridText = '';

    if('grid' in crossword) {
      let rows = [];
      let maxCoord = crossword.maxCoord;
      let grid = crossword.grid;

      {
        let row10s = [' ', ' ', ' '];
        let row1s  = [' ', ' ', ' '];
        let rowSpaces = [' ', ' ', ' '];
        for (var x = 1; x <= maxCoord; x++) {
          let num10s = Math.floor(x/10);
          row10s.push((num10s > 0)? num10s : ' ');
          row1s.push(x%10);
          rowSpaces.push(' ');
        }
        rows.push(row10s.join(''));
        rows.push(row1s.join(''));
        rows.push(rowSpaces.join(''));
      }

      for (var y = 1; y <= maxCoord; y++) {
        let row = [];
        {
          let num10s = Math.floor(y/10);
          row.push((num10s > 0)? num10s : ' ');
          row.push(y%10);
          row.push(' ');
        }
        for (var x = 1; x <= maxCoord; x++) {
          let cell = grid[(x-1) + (y-1)*maxCoord];
          cell = (cell === " ")? '.' : cell;
          row.push( cell );
        }
        rows.push( row.join('') );
      }
      gridText = rows.join("\n");
    }

    return gridText;
  }

  // having previously checked that the data encodes a valid crossword,
  // actually construct the spec as a data structure,
  // assuming a later step will convert it to JSON text
  function generateSpec(crossword){
    var spec = {
          name : crossword.name,
           author : crossword.author,
         editor : crossword.editor,
      copyright : crossword.copyright,
      publisher : crossword.publisher,
           date : crossword.pubdate,
           size : {
            rows : crossword.maxCoord,
            cols : crossword.maxCoord,
      },
        grid : [],
      gridnums : [],
         clues : {
          across : [],
            down : [],
      },
       answers : crossword.answers,
       notepad : "",
            id : crossword.name,
    };

    // flesh out spec grid
    for (var y = 1; y<=crossword.maxCoord; y++) {
      let row = [];
      for (var x = 1; x<=crossword.maxCoord; x++) {
        let cell = crossword.grid[(x-1) + (y-1)*crossword.maxCoord];
        row.push( (cell === ' ')? '.' : 'X' );
      }
      spec.grid.push(row);
    }

    // flesh out gridnums
    // fill with 0, then overwrite with ids

    for (var y = 1; y<=crossword.maxCoord; y++) {
      spec.gridnums.push( new Array(crossword.maxCoord).fill(0) );
    }

    for (var id in crossword.knownIds) {
      let clue = crossword.knownIds[id];
      spec.gridnums[clue.coordinates[1]-1][clue.coordinates[0]-1] = parseInt(id);
    }

    // flesh out clues

    ['across', 'down'].forEach( function(grouping){
      crossword[grouping].forEach( function(clue) {
        let item = [
          parseInt(clue.id),
          clue.body + ' (' + clue.numericCSV + ')',
          clue.wordsLengths,
          clue.numericCSV
        ];
        spec.clues[grouping].push(item);
      });
    });

    {
      // if the answers are just placeholders (lots of *s or Xs)
      // assume they are not to be displayed,
      // so delete them from the spec
      let concatAllAnswerWordsStrings = spec.answers.across.join('') + spec.answers.down.join('');
      if ( /^(X+|\*+)$/.test(concatAllAnswerWordsStrings) ) {
        delete spec['answers'];
      }
    }

    return spec;
  }

  // given a crossword obj, generate the DSL for it
  function generateDSL( crossword, withAnswers=true ){
    var lines = [];
    var nonClueFields = [
      'version', 'name', 'author', 'editor', 'copyright', 'publisher', 'pubdate',
    ];
    nonClueFields.forEach(field => {
      lines.push(`${field}: ${crossword[field]}`);
    });

    lines.push(`size: ${crossword.dimensions}`);

    ['across', 'down'].forEach( grouping => {
      lines.push(`${grouping}:`);
      crossword[grouping].forEach( clue => {
        var pieces = [
          '-',
          `(${clue.coordinates.join(',')})`,
          `${clue.id}.`,
          clue.body,
          `(${(withAnswers)? clue.answerCSV : clue.numericCSV})`
        ];
        lines.push(pieces.join(' '));
      });
    });

    var footerComments = [
      '',
      "Notes on the text format...",
      "Can't use square brackets or speech marks.",
      "A clue has the form",
      "- (COORDINATES) ID. Clue text (ANSWER)",
      "Coordinates of clue in grid are (across,down), so (1,1) = top left, (17,17) = bottom right.",
      "ID is a number, followed by a full stop.",
      "(WORDS,IN,ANSWER): capitalised, and separated by commas or hyphens, or (numbers) separated by commas or hyphens.",
      "ANSWERS with all words of ***** are converted to numbers.",
    ];
    lines = lines.concat( footerComments.map(c => { return `# ${c}`; } ) );

    let frontMatterLine = '---';
    lines.unshift( frontMatterLine );
    lines.push   ( frontMatterLine );

    var dsl = lines.join("\n");

    return dsl;
  }

  function convertTextIntoXMLWithErrors( text ){
    const parser = new DOMParser();
    xmlDoc = parser.parseFromString(text, "text/xml");
    const errors = [];
    if (xmlDoc.documentElement.nodeName == "parsererror") {
      errors.push( oDOM.documentElement.nodeName );
    }
    return {
      xmlDoc,
      errors
    }
  }

  // from https://davidwalsh.name/convert-xml-json
  function xmlToJson(xml) {

  	// Create the return object
  	var obj = {};

  	if (xml.nodeType == 1) { // element
  		// do attributes
  		if (xml.attributes.length > 0) {
  		obj["@attributes"] = {};
  			for (var j = 0; j < xml.attributes.length; j++) {
  				var attribute = xml.attributes.item(j);
  				obj["@attributes"][attribute.nodeName] = attribute.nodeValue;
  			}
  		}
  	} else if (xml.nodeType == 3) { // text
  		obj = xml.nodeValue;
  	}

  	// do children
  	if (xml.hasChildNodes()) {
  		for(var i = 0; i < xml.childNodes.length; i++) {
  			var item = xml.childNodes.item(i);
  			var nodeName = item.nodeName;
  			if (typeof(obj[nodeName]) == "undefined") {
  				obj[nodeName] = xmlToJson(item);
  			} else {
  				if (typeof(obj[nodeName].push) == "undefined") {
  					var old = obj[nodeName];
  					obj[nodeName] = [];
  					obj[nodeName].push(old);
  				}
  				obj[nodeName].push(xmlToJson(item));
  			}
  		}
  	}
  	return obj;
  };

  function parseCrosswordCompilerJsonIntoDSL( json ){
    let errors = [];
    let dslText = "duff output from parseCrosswordCompilerJsonIntoDSL";
    const today = new Date();
    const pubdate = [
      today.getFullYear(),
      (today.getMonth()+1 < 10)? '0' + (today.getMonth()+1) : today.getMonth()+1,
      today.getDate()
    ].join('/');

    let dslPieces = {
         name : 'UNSPECIFIED',
       author : 'UNSPECIFIED',
         size : 'UNSPECIFIED',
      pubdate : pubdate,
       across : [],
         down : [],
    };
    // now actually do the parsing of the CCW content into DSL
    try {

      if (! json.hasOwnProperty('crossword-compiler') ){
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler element');
      }
      if (! json['crossword-compiler'].hasOwnProperty('rectangular-puzzle') ){
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle element');
      }

      const rectpuzz = json['crossword-compiler']['rectangular-puzzle'];
      if (!rectpuzz.hasOwnProperty('metadata')) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.metadata element');
      }

      const metadata = rectpuzz.metadata;
      if (metadata.hasOwnProperty('title') && metadata.title.hasOwnProperty('#text')) {
        dslPieces.name = metadata.title['#text'];
      }
      if (metadata.hasOwnProperty('creator') && metadata.creator.hasOwnProperty('#text')) {
        dslPieces.author = metadata.creator['#text'];
      }

      if (!rectpuzz.hasOwnProperty('crossword')) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword element');
      }

      const crossword = rectpuzz.crossword;

      const clueCoords = {}; // clue id -> {x: 1, y: 2}
      const answers    = { across: {}, down: {} };

      if (!crossword.hasOwnProperty('grid')) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword.grid element');
      }
      if (! crossword.grid.hasOwnProperty('@attributes')) {
        errors.push('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword.grid @attributes');
      }

      const width  = crossword.grid['@attributes'].width;
      const height = crossword.grid['@attributes'].height;
      if (width !== height) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: conflicting width and height in crossword-compiler.rectangular-puzzle.crossword.grid @attributes');
      }

      dslPieces.size = `${width}x${width}`;

      if ( ! crossword.grid.hasOwnProperty('cell') ) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword.grid.cell element');
      }

      crossword.grid.cell.forEach( cell => {
        if (cell.hasOwnProperty('@attributes')) {
          if (cell['@attributes'].hasOwnProperty('number')) {
            clueCoords[cell['@attributes'].number] = {
              x : cell['@attributes'].x,
              y : cell['@attributes'].y
            };
          }
        }
      });

      console.log(`parseCrosswordCompilerJsonIntoDSL: found ${Object.keys(clueCoords).length} clueCoords` );

      if (! crossword.hasOwnProperty('word')) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword.word element');
      }

      crossword.word.forEach(word => {
        if (word.hasOwnProperty('@attributes')) {
          if (word['@attributes'].hasOwnProperty('solution')) {
            const direction = (word['@attributes'].x.match(/\-/))? 'across' : 'down';
            answers[direction][word['@attributes'].id] = word['@attributes'].solution;
          }
        }
      });

      console.log(`parseCrosswordCompilerJsonIntoDSL: found ${Object.keys(answers.across).length + Object.keys(answers.down).length} answers`);

      // then crossword.clues [across, down]
      if (! crossword.hasOwnProperty('clues')) {
        throw('ERROR: parseCrosswordCompilerJsonIntoDSL: missing crossword-compiler.rectangular-puzzle.crossword.clues element');
      }

      crossword.clues.forEach( group => {
        if ( group.hasOwnProperty('title')
             && group.title.hasOwnProperty('b')
             && group.title.b.hasOwnProperty('#text')
          ) {
          const direction = group.title.b['#text'].toLowerCase();
          if (direction !== 'across' && direction !== 'down') {
            throw(`ERROR: parseCrosswordCompilerJsonIntoDSL: crossword.clues have unrecognised direction=${direction}`);
          }
          group.clue.forEach( clue => {
            if (clue.hasOwnProperty('@attributes')) {
              const id = clue['@attributes'].number;
              if (! clueCoords.hasOwnProperty(id)) {
                throw(`ERROR: parseCrosswordCompilerJsonIntoDSL: clue id=${id} does not have a corresponding entry in clueCoords=${JSON.stringify(clueCoords, null, 2)}`);
              }
              dslPieces[direction].push({
                id     : id,
                format : clue['@attributes'].format,
                text   : clue['#text'],
                coord  : clueCoords[id],
              });
            }
          });
        }
      });

      console.log(`parseCrosswordCompilerJsonIntoDSL: found ${Object.keys(dslPieces.across).length + Object.keys(dslPieces.down).length} clues`);

      // version: standard v1
      // name: Polymousse 3456
      // author: Fred
      // editor: Colin Inman
      // copyright: 2017, Financial Times
      // publisher: Financial Times
      // pubdate: 2017/01/08
      // size: 17x17 # or 15x15
      // across:
      // - (1,1) 1. Gges (SCRAMBLED,EGGS)
      // - (3,3) 3. To Persia in a hurry (IRAN)
      // down:
      // - (1,1) 1. Gges (SCRAMBLED,EGGS)
      // - (3,1) 2. Its an air, a police, a disk (RAID)

      // construct dslText

      if (errors.length == 0) {
        dslText = Object.keys(dslPieces).map( field => {
          if (field == 'across' || field == 'down') {
            const clues = [`${field}:`];
            dslPieces[field].forEach(clue => {
              clues.push(`- (${clue.coord.x},${clue.coord.y}) ${clue.id}. ${clue.text} (${clue.format})`);
            })
            return clues.join("\n");
          } else {
            return `${field}: ${dslPieces[field]}`;
          }
        }).join("\n");
      }
    }
    catch( err ) {
      console.log(`parseCrosswordCompilerJsonIntoDSL: received an ERROR: err=${err}`);
      errors.push( err.toString() );
    }

    const returnObj = {
      dslText,
      errors,
    };

    console.log( `parseCrosswordCompilerJsonIntoDSL: returnObj=${JSON.stringify(returnObj, null, 2)}` );

    return returnObj;
  }

  // given some text, parse it into xml, convert it into the DSL, also returning any errors
  function parseCrosswordCompilerXMLIntoDSL( text ){
    let dslText = "duff output from xml parser";
    let errors = [];
    let xmlWithErrors = convertTextIntoXMLWithErrors( text );
    if (xmlWithErrors.errors.length > 0) {
      errors = errors.concat( xmlWithErrors.errors );
    } else {
      const json = xmlToJson( xmlWithErrors.xmlDoc );
      const dslTextWithErrors = parseCrosswordCompilerJsonIntoDSL( json );
      if (dslTextWithErrors.errors.length > 0) {
        errors = errors.concat( dslTextWithErrors.errors );
      } else {
        dslText = dslTextWithErrors.dslText;
      }
    }

    return {
      dslText,
      errors
    }
  }

  // given some text, decide what format it is,
  // and parse it accordingly,
  // If the input text indicates it is XML,
  //  check it is CrosswordCompiler XML, else error.
  // If it is CrosswordCompiler XML, attempt to parse it into DSL,
  //  and if that produces no errors, pass it to the DSL parser.
  // Generating the grid text and output format if there are no errors,
  // returning the crossword object with all the bits (or the errors).
  function parseWhateverItIs(text) {
    let possibleDSLText;
    let errors = [];
    if (text.match(/^\s*<\?xml/)) {
      console.log(`parseWhateverItIs: we haz xml`);
      if (text.match(/<crossword-compiler/)) {
        console.log(`parseWhateverItIs: we haz crossword-compiler xml`);
        const possibleDSLTextWithErrors = parseCrosswordCompilerXMLIntoDSL( text );
        if (possibleDSLTextWithErrors.errors.length > 0) {
          errors = possibleDSLTextWithErrors.errors;
        } else {
          possibleDSLText = possibleDSLTextWithErrors.dslText;
        }
      } else {
        errors = [ 'ERROR: input appears to be non-Crossword-Compiler XML' ];
      }
    } else {
      console.log(`parseWhateverItIs: we haz no xml`);
      possibleDSLText = text;
    }

    // console.log(`parseWhateverItIs: errors=${JSON.stringify(errors)}, possibleDSLText=${possibleDSLText}`);

    let crossword;

    if (errors.length > 0) {
      crossword = { errors: errors };
    } else {
      crossword = parseDSL(possibleDSLText);
    }

    // only attempt to validate the crossword if no errors found so far
    if (crossword.errors.length == 0) {
      crossword = validateAndEmbellishCrossword(crossword);
      console.log("parseWhateverItIs: validated crossword");
    } else {
      console.log("parseWhateverItIs: did not validate crossword=", crossword);
    }

    // generate the spec, and specTexts with and without answers
    var specTextWithoutAnswers = "";
    var specTextWithAnswers    = "";
    if (crossword.errors.length > 0) {
      specTextWithoutAnswers = crossword.errors.join("\n");
    } else {
      let specWithAnswers = generateSpec(crossword);
      crossword.spec = specWithAnswers;
      specTextWithAnswers = JSON.stringify(specWithAnswers);

      let specWithoutAnswers = generateSpec(crossword);
      delete specWithoutAnswers['answers'];
      specTextWithoutAnswers = JSON.stringify(specWithoutAnswers);
    }
    crossword.specTextWithAnswers    = specTextWithAnswers;
    crossword.specTextWithoutAnswers = specTextWithoutAnswers;

    crossword.gridText = generateGridText( crossword );

    if (crossword.errors.length == 0) {
      console.log('parseWhateverItIs: no errors so generated DSLs');
      let withAnswers = true;
      crossword.DSLGeneratedFromDSLWithAnswers = generateDSL( crossword, withAnswers );
      crossword.DSLGeneratedFromDSLWithoutAnswers = generateDSL( crossword, ! withAnswers );
    } else {
      console.log( "parseWhateverItIs: errors found:\n", crossword.errors.join("\n") );
    }

    return crossword;
  }

  function parseWhateverItIsIntoSpecJson(text) {
    // returns spec or errors as JSON
    var crossword = parseWhateverItIs(text);

    var responseObj;
    if (crossword.errors.length == 0) {
      console.log("parseWhateverItIsIntoSpecJson: no errors found");
      responseObj = crossword.spec;
    } else {
      responseObj = {
        errors: crossword.errors,
        text  : text
      }
      console.log("parseWhateverItIsIntoSpecJson: errors found:\n", crossword.errors.join("\n"), "\ntext=\n", text);
    }

    var jsonText = JSON.stringify( responseObj );

    return jsonText;
  }

  return {
    'whateverItIs' : parseWhateverItIs,
    'intoSpecJson' : parseWhateverItIsIntoSpecJson
  };
}));
