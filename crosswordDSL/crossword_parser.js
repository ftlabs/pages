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

  function nowAsYYYMMDDD(){
    const today = new Date();
    const month = today.getMonth()+1;
    const monthMM = (month < 10)? '0' + month : month;
    const day = today.getDate();
    const dayDD = (day < 10)? '0' + day : day;
    const yyymmdd = [
      today.getFullYear(),
      monthMM,
      dayDD,
    ].join('/');

    return yyymmdd;
  }

  function ccwJsonCheckMainFields(json){
    if (! json.hasOwnProperty('crossword-compiler') ){
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler element');
    }
    if (! json['crossword-compiler'].hasOwnProperty('rectangular-puzzle') ){
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle element');
    }

    const rectpuzz = json['crossword-compiler']['rectangular-puzzle'];
    if (!rectpuzz.hasOwnProperty('metadata')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.metadata element');
    }

    if (!rectpuzz.hasOwnProperty('crossword')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword element');
    }

    const crossword = rectpuzz.crossword;

    if (!crossword.hasOwnProperty('grid')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.grid element');
    }
    if (! crossword.grid.hasOwnProperty('@attributes')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.grid @attributes');
    }

    if ( ! crossword.grid.hasOwnProperty('cell') ) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.grid.cell element');
    }

    if ( ! crossword.grid['@attributes'].hasOwnProperty('width') ) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.grid.@attributes.width attribute');
    }
    if ( ! crossword.grid['@attributes'].hasOwnProperty('height') ) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.grid.@attributes.height attribute');
    }

    if (crossword.grid['@attributes'].width !== crossword.grid['@attributes'].height) {
      throw('ERROR: ccwParseJsonIntoDSL: conflicting width and height in crossword-compiler.rectangular-puzzle.crossword.grid @attributes');
    }

    crossword.grid.cell.forEach( cell => {
      if (! cell.hasOwnProperty('@attributes')) {
        throw(`ERROR: ccwJsonCheckMainFields: missing @attributes in cell=${JSON.stringify(cell)}`);
      }
    });

    if (! crossword.hasOwnProperty('word')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.word element');
    }

    if (! crossword.hasOwnProperty('clues')) {
      throw('ERROR: ccwJsonCheckMainFields: missing crossword-compiler.rectangular-puzzle.crossword.clues element');
    }

  }

  function ccwJsonParseGrid( json ) {
    const grid = {}; // {y}{x}=cell@attributes, {y=1}{x=1} is top left corner
    const crossword = json['crossword-compiler']['rectangular-puzzle'].crossword;
    crossword.grid.cell.forEach( cell => {
      const x = cell['@attributes'].x;
      const y = cell['@attributes'].y;
      if (! grid.hasOwnProperty(y)) {
        grid[y] = {};
      }
      grid[y][x] = cell['@attributes'];
    });
    // console.log(`ccwJsonParseGrid: grid=${JSON.stringify(grid, null, 2)}`);
    return grid;
  }

  function ccwJsonParseClueCoords( json ) {
    const clueCoords = {}; // {x}{y}=cell@attributes
    const crossword = json['crossword-compiler']['rectangular-puzzle'].crossword;
    crossword.grid.cell.forEach( cell => {
      const x = cell['@attributes'].x;
      const y = cell['@attributes'].y;
      if (cell['@attributes'].hasOwnProperty('number')) {
        clueCoords[cell['@attributes'].number] = {
          x : x,
          y : y
        };
      }
    });
    // console.log(`ccwJsonParseClueCoords: found ${Object.keys(clueCoords).length} clueCoords` );
    return clueCoords;
  }

  // function ccwJsonParseAnswers( json ) {
  //   const answers = { across: {}, down: {} };
  //   const crossword = json['crossword-compiler']['rectangular-puzzle'].crossword;
  //   // not clear this is worth doing
  //   crossword.word.forEach(word => {
  //     if (word.hasOwnProperty('@attributes')) {
  //       if (word['@attributes'].hasOwnProperty('solution')) {
  //         const direction = (word['@attributes'].x.match(/\-/))? 'across' : 'down';
  //         answers[direction][word['@attributes'].id] = word['@attributes'].solution;
  //       }
  //     }
  //   });
  //   console.log(`ccwJsonParseAnswers: found ${Object.keys(answers.across).length + Object.keys(answers.down).length} answers`);
  //   return answers;
  // }

  function ccwJsonParseCluesExtant( json, clueCoords ) {
    const clues = { across: {}, down: {} };
    const crossword = json['crossword-compiler']['rectangular-puzzle'].crossword;
    crossword.clues.forEach( group => {
      let direction;
      if (
        group.hasOwnProperty('title')
        && group.title.hasOwnProperty('b')
        && group.title.b.hasOwnProperty('#text')
      ) {
          direction = group.title.b['#text'].toLowerCase();
      } else if (
        group.hasOwnProperty('title')
        && group.title.hasOwnProperty('#text')
      ) {
          direction = group.title['#text'].toLowerCase();
      } else {
        throw `ERROR: ccwJsonParseCluesExtant: cannot find title.b.#text or title.#text in group=${JSON.stringify(group,null,2)}`;
      }

      if (direction !== 'across' && direction !== 'down') {
        throw(`ERROR: ccwJsonParseCluesExtant: crossword.clues have unrecognised direction=${direction}`);
      }
      group.clue.forEach( clue => {
        if (!clue.hasOwnProperty('@attributes')) {
          throw `ERROR: ccwJsonParseCluesExtant: no @attributes in clue=${JSON.stringify(clue, null, 2)}`;
        }
        if (!clue['@attributes'].hasOwnProperty('number')) {
          throw `ERROR: ccwJsonParseCluesExtant: no number in clue.@attributes=${JSON.stringify(clue['@attributes'], null, 2)}`;
        }

        // console.log(`ccwJsonParseCluesExtant: clue=${JSON.stringify(clue, null, 2)}`);

        let clueText;
        if (clue.hasOwnProperty('#text')) {
          clueText = clue['#text'];
        } else if( clue.hasOwnProperty('span') && clue.span.length==2 && clue.hasOwnProperty('i') && clue.i.hasOwnProperty('#text') ){
          // nasty hack to overcome embedded italic word in clue: text italicText text
          // arising from an issue with the chosen XML->JSON converter
          clueText = [
            clue.span[0]['#text'],
            '<i>', clue.i['#text'], '</i>',
            clue.span[1]['#text']
          ].join('');
        } else if( clue.hasOwnProperty('span') && clue.span.hasOwnProperty('#text') && clue.hasOwnProperty('i') && clue.i.hasOwnProperty('#text') ){
          // nasty hack to overcome embedded italic word in clue: italicText text
          // (will get it wrong if it is: text italicText)
          // arising from an issue with the chosen XML->JSON converter
          clueText = [
            '<i>', clue.i['#text'], '</i>',
            clue.span['#text']
          ].join('');
        } else {
          throw `ERROR: ccwJsonParseCluesExtant: no text in clue.@attributes, nor span+i in clue: clue=${JSON.stringify(clue, null, 2)}`;
        }

        const id = clue['@attributes'].number;
        clues[direction][id] = {
          id     : id,
          format : clue['@attributes'].format,
          text   : clueText,
          coord  : clueCoords[id],
        };
      });
    });
    // console.log(`ccwJsonParseCluesExtant: clues=${JSON.stringify(clues, null, 2)}`);
    return clues;
  }

  function ccwCalcAnswersDirectionAndSizeFromGrid( grid ){
    const answers = {};
    const size = Object.keys(grid).length;

    for (let x = 1; x <= size; x++) {
      for (let y = 1; y <= size; y++) {
        if (grid[y][x].hasOwnProperty('number')) {
          const id = grid[y][x].number;
          answers[id] = {
            coords    : {x, y},
            directions: {} // could be across and/or down
          };
          // check if is across, and scan to get length and letters of full answers
          if((x<size)
          && (grid[y][x+1].type !== 'block')
          && (x==1 || grid[y][x-1].type == 'block')
          ) {
            const chars = [];
            for(let wx=x; wx<=size; wx++){
              if (grid[y][wx].type == 'block') {
                break;
              } else {
                chars.push( grid[y][wx].solution );
              }
            }
            answers[id].directions['across'] = {
              length: chars.length,
              text  : chars.join(''),
            };
          }
          // ditto for down
          if((y<size)
          && (grid[y+1][x].type !== 'block')
          && (y==1 || grid[y-1][x].type == 'block')
          ) {
            const chars = [];
            for(let wy=y; wy<=size; wy++){
              if (grid[wy][x].type == 'block') {
                break;
              } else {
                chars.push( grid[wy][x].solution );
              }
            }
            answers[id].directions['down'] = {
              length: chars.length,
              text  : chars.join(''),
            };
          }

          answers[id].numDirections = Object.keys(answers[id].directions).length;
        }
      }
    }

    // console.log(`ccwCalcAnswersDirectionAndSizeFromGrid: answers=${JSON.stringify(answers,null,2)}`);

    return answers;
  }

  function ccwCalcSequenceInfoForMultiClues( clues, answers, clueCoords ){
    // build up the set of clue details,
    //  first get the extant clue details, including the multi-clue answers mixed in
    // for clues of a multi-clue answer,
    //   work out each one's answer size (which portion of the main csv)
    //   2nd+ clues always defer to 1st clue in multi

    ['across', 'down'].forEach( direction => {
      const ids = Object.keys(clues[direction]);
      const idsMultiOnly = ids.filter( id => { return id.match(/,/); });

      // console.log(`ccwCalcSequenceInfoForMultiClues: idsMultiOnly=${idsMultiOnly}`);

      idsMultiOnly.forEach( idMulti => {
        const ids = idMulti.split(/,\s*/);
        // console.log(`ccwCalcSequenceInfoForMultiClues: idMulti=${idMulti}, clues.${direction}[idMulti]=${JSON.stringify(clues[direction][idMulti])}`);
        ids.forEach( id => {
          if (! id.match(/^\d+$/) ) {
            throw(`ERROR: ccwCalcSequenceInfoForMultiClues: could not parse clue id=${idMulti}`);
          }
        });

        const multiSequence = [];

        // get the existing multi clue entry,
        // create a new one for each constituent clue
        const firstId = ids[0];
        const multiFormats = clues[direction][idMulti].format;
        const firstLength = answers[firstId].directions[direction]['length'];
        clues[direction][firstId] = {
          id          : firstId,
          multiIds    : idMulti,
          multiFormats: multiFormats,
          text        : clues[direction][idMulti].text,
          coord       : clueCoords[firstId],
          length      : firstLength,
          multiSequence: multiSequence,
        };

        multiSequence.push({
          id       : firstId,
          direction: direction,
          length   : firstLength,
        });

        const childIds = ids.slice(1);
        childIds.forEach( childId => {
          // how do we know which direction the clue belongs to?
          let childDirection = direction;
          if (answers[childId].numDirections == 2) {
            // assume is same direction as first, but this is NOT RIGHT and will need to be addressed forthwith
          } else {
            childDirection = Object.keys(answers[childId].directions)[0];
          }

          const childLength = answers[childId].directions[childDirection]['length'];
          clues[childDirection][childId] = {
            id    : childId,
            text  : `See ${firstId} ${direction}`,
            coord : clueCoords[childId],
            first : {
              id       : firstId,
              direction: direction
            },
            length : childLength,
          };

          multiSequence.push({
            id       : childId,
            direction: childDirection,
            length   : childLength,
          });
        } );

        const multiSequencePiecesForPrefix = multiSequence.slice(1).map( seqItem => {
          return (answers[seqItem.id].numDirections == 1)? seqItem.id : `${seqItem.id} ${seqItem.direction}`;
        })

        clues[direction][firstId].multiPrefix = ',' + multiSequencePiecesForPrefix.join(',');
      });
    });
    // console.log(`ccwCalcSequenceInfoForMultiClues: clues=${JSON.stringify(clues, null, 2)}`);

    return clues;
  }

  function ccwCalcFormatsForMultiClues( clues ){
    // parse format
    // distribute format among multi
    //  check it all adds up
    //  loop over list, plucking off the format segments that fit into teh clue length
    // update clue entries

    ['across', 'down'].forEach( direction => {
      const ids = Object.keys(clues[direction]);
      const idsMultiOnly = ids.filter( id => { return clues[direction][id].hasOwnProperty('multiSequence'); });

      // console.log(`ccwCalcFormatsForMultiClues: direction=${direction}, idsMultiOnly=${JSON.stringify(idsMultiOnly)}`);

      idsMultiOnly.forEach( id => {
        const clue = clues[direction][id];
        const multiFormatList = clue.multiFormats.split(/[,\-]/);
        // console.log(`ccwCalcFormatsForMultiClues: id=${id}, clues.${direction}[${id}]=${JSON.stringify(clue, null, 2)}, \nmultiFormatList=${JSON.stringify(multiFormatList)}`);
        // loop over multiSequence
        //   unpack head of remaining multiFormatList into current sequence item until full
        const remainingFormats = multiFormatList.slice();
        clue.multiSequence.forEach( currentSeqClue => {
          const currentSeqFormats = [];
          let remainingAnswerLength = currentSeqClue['length'];
          while (remainingAnswerLength > 0) {
            if (remainingFormats.length == 0) {
              throw `ERROR: cannot distribute formats among multi-clue: clue=${clue}: not enough remaining format values for currentSeqClue=${currentSeqClue}`;
            }
            if (remainingFormats[0] > remainingAnswerLength) {
              throw `ERROR: cannot distribute formats among multi-clue: clue=${clue}: remaining format value, ${remainingFormats[0]}, too large for remainingAnswerLength, ${remainingAnswerLength}: currentSeqClue=${currentSeqClue}`;
            }
            const format = remainingFormats.shift();
            currentSeqFormats.push(format);
            remainingAnswerLength = remainingAnswerLength - format;
          }

          currentSeqClue.format = currentSeqFormats.join(',');
        });
        if (remainingFormats.length > 0) {
          throw `ERROR: cannot fully distribute formats among multi-clue: clue=${clue}: some remainingFormats, ${remainingFormats}`;
        }

        // console.log(`ccwCalcFormatsForMultiClues: id=${id}, clues.${direction}[${id}]=${JSON.stringify(clue, null, 2)}`);

        // update the relevant clues with newly calculated format values
        clue.multiSequence.forEach( currentSeqClue => {
          clues[currentSeqClue.direction][currentSeqClue.id].format = currentSeqClue.format;
        } );
      } );
    } );
    // console.log(`ccwCalcFormatsForMultiClues: clues=${JSON.stringify(clues, null, 2)}`);
    return clues;
  }

  function ccCalcCluesFormattedAnswers( clues, answers ){
    // loop over all answers
    //   look up answer chars for slot
    //   parse according to format
    //   update clue

    Object.keys(answers).forEach( id => {
      ['across', 'down'].forEach( direction => {
        if (answers[id].directions.hasOwnProperty(direction)) {
          if (!clues[direction].hasOwnProperty(id)) {
            throw `ERROR: ccCalcCluesFormattedAnswers: cannot find clue[${direction}][${id}] from answer=${answers[id]}`;
          }
          const clue = clues[direction][id];
          const answerText = answers[id].directions[direction].text;
          const clueFormat = clue.format;
          const clueFormatNumbers = clueFormat.split(/[,\-]/).map(n=>{return parseInt(n);}); // '1-2-34,456' --> [1, 2, 34, 456]
          const clueFormatDividers = clueFormat.split(/\d+/).slice(1,-1);    // '1-2-34,456' --> ["-", "-", ","]
          if (clueFormatNumbers.length != (clueFormatDividers.length+1)) {
            throw `ERROR: ccCalcCluesFormattedAnswers: clueFormatNumbers.length)()${clueFormatNumbers.length}) != clueFormatDividers.length+1(${clueFormatDividers.length+1}) }`
          }
          let pos = 0;
          const answerTextPieces = clueFormatNumbers.map(num => {
            const piece = answerText.slice(pos, pos+num);
            pos = pos + num;
            return piece;
          });
          if (answerTextPieces.length != clueFormatNumbers.length) {
            throw `ERROR: ccCalcCluesFormattedAnswers: answerTextPieces.length(${answerTextPieces.length}) != clueFormatNumbers.length(${clueFormatNumbers.length})`;
          }
          const answerTextFragments = [answerTextPieces[0]];
          clueFormatDividers.forEach( (cfd, i) => {
            answerTextFragments.push( cfd );
            answerTextFragments.push( answerTextPieces[i+1] );
          });
          const answerTextFormatted = answerTextFragments.join('');
          clue.formattedAnswer = answerTextFormatted;
          // console.log(`ccCalcCluesFormattedAnswers: id=${id}, direction=${direction}: answerText=${answerText}, clueFormat=${clueFormat}, clueFormatNumbers=${JSON.stringify(clueFormatNumbers)}, answerTextFormatted=${answerTextFormatted}`);
        }
      } );
    });

    return clues;
  }

  function ccwGenerateDslTextFromDslPieces( dslPieces ){
    const dslText = Object.keys(dslPieces).map( field => {
      if (field == 'across' || field == 'down') {
        const clues = [`${field}:`];
        let ids = Object.keys(dslPieces[field]);
        ids.sort((a,b) => {return parseInt(a)-parseInt(b);});
        ids.forEach(id => {
          const clue = dslPieces[field][id];
          const format = (clue.hasOwnProperty('formattedAnswer'))? clue.formattedAnswer : clue.format;
          const multiPrefixThingy = (clue.hasOwnProperty('multiPrefix'))? ` ${clue.multiPrefix}. ` : '';
          clues.push(`- (${clue.coord.x},${clue.coord.y}) ${clue.id}. ${multiPrefixThingy}${clue.text} (${format})`);
        })
        return clues.join("\n");
      } else {
        return `${field}: ${dslPieces[field]}`;
      }
    }).join("\n");
    return dslText;
  }

  function ccwPortCluesToDslPieces( clues, answers, dslPieces ){
    // port all the relevant clues to dslPieces, reading from the answers cos clues might contain  leftover multi entries

    const ids = Object.keys(answers).sort((a,b) => {return parseInt(a)-parseInt(b);});
    ids.forEach( id => {
      ['across', 'down'].forEach( direction => {
        if (answers[id].directions.hasOwnProperty(direction)) {
          dslPieces[direction][id] = clues[direction][id];
        }
      } );
    } );

    return dslPieces;
  }

  function ccwParseJsonIntoDSL( json ){
    let errors = [];
    let dslText = "duff output from ccwParseJsonIntoDSL";
    const today = new Date();
    const pubdate = nowAsYYYMMDDD();

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

      ccwJsonCheckMainFields(json);

      const rectpuzz = json['crossword-compiler']['rectangular-puzzle'];

      const metadata = rectpuzz.metadata;
      if (metadata.hasOwnProperty('title') && metadata.title.hasOwnProperty('#text')) {
        dslPieces.name = metadata.title['#text'];
      }
      if (metadata.hasOwnProperty('creator') && metadata.creator.hasOwnProperty('#text')) {
        dslPieces.author = metadata.creator['#text'];
      }

      const crossword = rectpuzz.crossword;
      const width     = crossword.grid['@attributes'].width;
      const height    = crossword.grid['@attributes'].height;

      dslPieces.size = `${width}x${width}`;

      const grid       = ccwJsonParseGrid       (json); // {x}{y}=cell@attributes
      const clueCoords = ccwJsonParseClueCoords (json); // clue id -> {x: 1, y: 2}
      const answers    = ccwCalcAnswersDirectionAndSizeFromGrid(grid); // { id : {coords, directions : {across/down: {length, text}}} }
      const clues      = ccwJsonParseCluesExtant(json, clueCoords); // { across: {}, down: {} };

      ccwCalcSequenceInfoForMultiClues( clues, answers, clueCoords );
      ccwCalcFormatsForMultiClues( clues );
      ccCalcCluesFormattedAnswers( clues, answers );
      ccwPortCluesToDslPieces( clues, answers, dslPieces );

      // console.log(`ccwParseJsonIntoDSL: found ${Object.keys(dslPieces.across).length + Object.keys(dslPieces.down).length} clues`);

      if (errors.length > 0) {
        throw `ERROR: ccwParseJsonIntoDSL: irony alert. Its an error that we have an error at this stage`;
      }

      dslText = ccwGenerateDslTextFromDslPieces( dslPieces );
    }
    catch( err ) {
      console.log(`ccwParseJsonIntoDSL: received an ERROR: err=${err}`);
      errors.push( err.toString() );
    }

    const returnObj = {
      dslText,
      errors,
    };

    console.log( `ccwParseJsonIntoDSL: dslText=${dslText},\nerrors=${JSON.stringify(errors)}` );

    return returnObj;
  }

  // given some text, parse it into xml, convert it into the DSL, also returning any errors
  function ccwParseXMLIntoDSL( text ){
    let dslText = "duff output from xml parser";
    let errors = [];
    let xmlWithErrors = convertTextIntoXMLWithErrors( text );
    if (xmlWithErrors.errors.length > 0) {
      errors = errors.concat( xmlWithErrors.errors );
    } else {
      const json = xmlToJson( xmlWithErrors.xmlDoc );
      // console.log(`DEBUG: ccwParseXMLIntoDSL: json=${JSON.stringify(json, null, 2)}`);
      const dslTextWithErrors = ccwParseJsonIntoDSL( json );
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
    if (! text.match(/^\s*<\?xml/)) {
      console.log(`parseWhateverItIs: we haz no xml`);
      possibleDSLText = text;
    } else {
      console.log(`parseWhateverItIs: we haz xml`);
      if (! text.match(/<crossword-compiler/)) {
        errors = [ 'ERROR: input appears to be non-Crossword-Compiler XML' ];
      } else {
        console.log(`parseWhateverItIs: we haz crossword-compiler xml`);
        const possibleDSLTextWithErrors = ccwParseXMLIntoDSL( text );
        if (possibleDSLTextWithErrors.errors.length > 0) {
          errors = possibleDSLTextWithErrors.errors;
        } else {
          possibleDSLText = possibleDSLTextWithErrors.dslText;
        }
      }
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
