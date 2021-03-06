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
      copyright    : "2018, Financial Times",
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
        } else {
          throw `ERROR: ccwJsonParseCluesExtant: no text in clue.@attributes: clue=${JSON.stringify(clue, null, 2)}`;
        }

        let clueAttributesFormat = clue['@attributes'].format;
        if (clueAttributesFormat) {
          // convert anything that isn't a number or comma or hyphen into a comma
          clueAttributesFormat = clueAttributesFormat.replace(/[^\d,\-]/g, ',');
        }

        // if (clueAttributesFormat && ! clueAttributesFormat.match(/^\d+([,\-]\d+)*$/) ) {
        //   throw `ERROR: ccwJsonParseCluesExtant: could not parse clue.@attributes.format: clue=${JSON.stringify(clue, null, 2)}`;
        // }

        const id = clue['@attributes'].number;
        clues[direction][id] = {
          id     : id,
          format : clueAttributesFormat,
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

      // perhaps pre-process each idsMulti to make the implicit directions explicit, e.g. in 'down' having a clue with idsMulti="3,14" and 14 being an 'across'-only clue: more explicit would be "3, 14 down"

      idsMultiOnly.forEach( idMulti => {
        const ids = idMulti.split(/,\s*/);
        ids.forEach( id => {
          if (! id.match(/^\d+(?: down| across)?$/) ) {
            throw(`ERROR: ccwCalcSequenceInfoForMultiClues: could not parse clue idMulti="${idMulti}", id="${id}"`);
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

        const childIdsWithDirections = ids.slice(1);
        childIdsWithDirections.forEach( childIdWithDirection => {
          // how do we know which direction the clue belongs to?
            // assume childIdWithDirection is either a number (defaults to the current direction)
            // or a number followed by "down" or "across"

          const childIdWithDirectionParts = childIdWithDirection.split(/\s+/);
          const childId = childIdWithDirectionParts[0];
          // const childDirection = (childIdWithDirectionParts.length == 2)? childIdWithDirectionParts[1] : direction;

          if (! answers.hasOwnProperty(childId) ) {
            throw(`ERROR: ccwCalcSequenceInfoForMultiClues: answers does not contain childId="${childId}"`);
          }

          let childDirection;
          if (childIdWithDirectionParts.length == 2) {
            childDirection = childIdWithDirectionParts[1];
          } else if (answers[childId].directions.hasOwnProperty(direction) ) {
            childDirection = direction;
          } else {
            const otherDirection = (direction === 'across')? 'down' : 'across';
            childDirection = otherDirection;
          }
          console.log(`ccwCalcSequenceInfoForMultiClues: childId=${childId}, childDirection=${childDirection}`);

          if (! answers[childId].directions.hasOwnProperty(childDirection) ) {
            throw(`ERROR: ccwCalcSequenceInfoForMultiClues: answers[childId="${childId}"].directions does not contain direction="${childDirection}",
            clues[direction="${direction}"][idMulti="${idMulti}"]="${JSON.stringify(clues[direction][idMulti],null, 2)}"`);
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
        const multiFormatList = clue.multiFormats.split(/\s*[:,\-]\s*/);
        // console.log(`ccwCalcFormatsForMultiClues: id=${id}, clues.${direction}[${id}]=${JSON.stringify(clue, null, 2)}, \nmultiFormatList=${JSON.stringify(multiFormatList)}`);
        // loop over multiSequence
        //   unpack head of remaining multiFormatList into current sequence item until full
        const remainingFormats = multiFormatList.slice();
        clue.multiSequence.forEach( currentSeqClue => {
          const currentSeqFormats = [];
          let remainingAnswerLength = currentSeqClue['length'];
          while (remainingAnswerLength > 0) {
            if (remainingFormats.length == 0) {
              throw `ERROR: cannot distribute formats among multi-clue: clue=${JSON.stringify(clue, null, 2)}: not enough remaining format values for currentSeqClue=${JSON.stringify(currentSeqClue, null, 2)}`;
            }
            if (remainingFormats[0] > remainingAnswerLength) {
              throw `ERROR: cannot distribute formats among multi-clue: clue=${JSON.stringify(clue, null, 2)}: remaining format value, ${remainingFormats[0]}, too large for remainingAnswerLength, ${remainingAnswerLength}: currentSeqClue=${JSON.stringify(currentSeqClue, null, 2)}`;
            }
            const format = remainingFormats.shift();
            currentSeqFormats.push(format);
            remainingAnswerLength = remainingAnswerLength - format;
          }

          currentSeqClue.format = currentSeqFormats.join(',');
        });
        if (remainingFormats.length > 0) {
          throw `ERROR: cannot fully distribute formats among multi-clue: clue=${JSON.stringify(clue, null, 2)}: some remainingFormats, ${remainingFormats}`;
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
            throw `ERROR: ccCalcCluesFormattedAnswers: clueFormatNumbers.length (${clueFormatNumbers.length}) != clueFormatDividers.length+1 (${clueFormatDividers.length+1}), from answer.id=${id} direction=${direction}, clue=${JSON.stringify(clues[direction][id], null, 2)};`
          }
          let pos = 0;
          const answerTextPieces = clueFormatNumbers.map(num => {
            const piece = answerText.slice(pos, pos+num);
            pos = pos + num;
            return piece;
          });
          if (answerTextPieces.length != clueFormatNumbers.length) {
            throw `ERROR: ccCalcCluesFormattedAnswers: answerTextPieces.length(${answerTextPieces.length}) != clueFormatNumbers.length(${clueFormatNumbers.length}), from answer.id=${id} direction=${direction}`;
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

  function preProcessTextBeforeConvertingToXML( text, errors ){
    let preprocessedText = text
      .replace( /<span>/gi, '')     // in the <clue> elements, replace span+it in xml with _i_ (start italics) and _ii_ (end italics)
      .replace( /<\/span>/gi, '')
      .replace( /<i>/gi, '_i_')
      .replace( /<\/i>/gi, '_ii_')
      .replace( /\n/g, '')          // also noticed some spurious-looking line breaks, so get rid of them
      ;

    return preprocessedText;
  }

  function postProcessJson( json, errors ){
    // rather than walk the obj tree, convert it all into a string, regex replace, then back into json

    let text = JSON.stringify(json);
    text = text
    .replace(/_i_/g, '<i>')    // convert all _i_ back into <i>
    .replace(/_ii_/g, '</i>')  // and _ii_ back into </i>
    ;

    return JSON.parse( text );
  }

  // given some text, convert it into xml, parse that and generate the DSL,
  // returning {
  //   dslText: "YAML text spec",
  //   errors: []
  // }
  function ccwParseXMLIntoDSL( text ){
    let dslText = "duff output from xml parser";
    let errors = [];
    let preprocessedText = preProcessTextBeforeConvertingToXML( text, errors );
    let xmlWithErrors = convertTextIntoXMLWithErrors( preprocessedText );
    if (xmlWithErrors.errors.length > 0) {
      errors = errors.concat( xmlWithErrors.errors );
    } else {
      const json = xmlToJson( xmlWithErrors.xmlDoc );
      const postProcessedJson = postProcessJson( json );
      const dslTextWithErrors = ccwParseJsonIntoDSL( postProcessedJson );
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

  // parsing QuickSlow crosswords

  function parseQuickSlowIntoObj( text ){
    let quickSlowClues = {
      name      : 'Quick Slow 1',
      pubdate   : '2018/02/02',
      author    : 'anon',
      version   : 'standard v1',
      editor    : 'anon',
      copyright : '2018, Financial Times Ltd',
      publisher : "Financial Times",
      across    : [],
      down      : [],
      text      : text,
      errors    : [],
    };

    let cluesGrouping;

    let lines = text.split(/\r|\n/);

    for(let line of lines){
      let match;
      // strip out trailing and leading spaces
      line = line.trim();

      if     ( line === ""   ) {
        /* ignore blank lines */
      }
      else if (line.match('The Across clues are straightforward')){
        /* ignore */
      }
      else if (match = /^(Quick\s+Slow\s+\d+)\s+issue\s+(\d+)\/(\d+)\/(\d+).*Please\s+credit\s+‘(.+)’/i.exec(line) ) {
        // Quick Slow 375 issue 03/03/18 / [...] Please credit ‘Aldhelm’ / 1 of 4
        quickSlowClues.name    = match[1];
        quickSlowClues.pubdate = `20${match[4]}/${match[3]}/${match[2]}`;
        quickSlowClues.author  = match[5];
      }
      else if (match = /^(across|down)$/i.exec(line) ) {
        cluesGrouping = match[1].toLowerCase();
      }
      else if (match = /^(\d+)\s+(.+)\s+\(([0-9,-\s]+)\)$/.exec(line) ) {
        // 2 Author who&#39;s hoping to hit his targets? (6, 2)
        if (! /(across|down)/.test(cluesGrouping)) {
          quickSlowClues.errors.push(`ERROR: clue specified but no 'across' or 'down' grouping specified: "${line}"`);
          break;
        } else {
          let clue = {
                     id : parseInt(match[1]),
                   body : match[2].replace(/&#39;/g, "\'"),
             numericCSV : match[3].replace(/\s+/g, ''), // could be in the form of either "A,LIST-OF,WORDS" or "1,4-2,5", but no spaces
               original : line,
          };
          quickSlowClues[cluesGrouping].push(clue);
        }
      } else {
        quickSlowClues.errors.push("ERROR: couldn't parse line: " + line);
      }
    };

    if (quickSlowClues.across.length === 0) {
      quickSlowClues.errors.push('ERROR: no across clues found');
    }
    if (quickSlowClues.down.length === 0) {
      quickSlowClues.errors.push('ERROR: no down clues found');
    }

    return quickSlowClues;
  }

  const QuickSlowTemplateYamls = [
    `name: QuickSlow grid1 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (1,2) 7. Clue (9)
- (11,2) 8. Clue (5)
- (1,4) 10. Clue (6)
- (8,4) 11. Clue (8)
- (3,6) 12. Clue (6)
- (10,6) 14. Clue (6)
- (1,8) 16. Clue (4)
- (6,8) 17. Clue (5)
- (12,8) 18. Clue (4)
- (1,10) 19. Clue (6)
- (8,10) 21. Clue (6)
- (1,12) 24. Clue (8)
- (10,12) 26. Clue (6)
- (1,14) 27. Clue (5)
- (7,14) 28. Clue (9)
down:
- (2,1) 1. Clue (5)
- (4,1) 2. Clue (8)
- (6,1) 3. Clue (6)
- (8,1) 4. Clue (4)
- (12,1) 5. Clue (6)
- (14,1) 6. Clue (9)
- (10,3) 9. Clue (6)
- (8,6) 13. Clue (5)
- (2,7) 15. Clue (9)
- (6,8) 17. Clue (6)
- (12,8) 18. Clue (8)
- (4,10) 20. Clue (6)
- (10,10) 22. Clue (6)
- (14,11) 23. Clue (5)
- (8,12) 25. Clue (4)`,

`name: QuickSlow grid2 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (2,1) 1. Clue (11)
- (1,3) 10. Clue (5)
- (7,3) 11. Clue (9)
- (1,5) 12. Clue (9)
- (11,5) 13. Clue (5)
- (1,7) 14. Clue (6)
- (8,7) 16. Clue (8)
- (1,9) 18. Clue (8)
- (10,9) 20. Clue (6)
- (1,11) 23. Clue (5)
- (7,11) 24. Clue (9)
- (1,13) 26. Clue (9)
- (11,13) 27. Clue (5)
- (4,15) 28. Clue (11)
down:
- (3,1) 2. Clue (5)
- (5,1) 3. Clue (7)
- (7,1) 4. Clue (6)
- (9,1) 5. Clue (8)
- (11,1) 6. Clue (7)
- (1,2) 7. Clue (13)
- (13,2) 8. Clue (8)
- (15,2) 9. Clue (13)
- (3,7) 15. Clue (8)
- (7,8) 17. Clue (8)
- (5,9) 19. Clue (7)
- (11,9) 21. Clue (7)
- (9,10) 22. Clue (6)
- (13,11) 25. Clue (5)`,

`name: QuickSlow grid3 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (1,1) 1. Clue (8)
- (10,1) 6. Clue (6)
- (1,3) 9. Clue (6)
- (8,3) 10. Clue (8)
- (1,5) 11. Clue (8)
- (10,5) 12. Clue (6)
- (4,7) 13. Clue (12)
- (1,9) 16. Clue (12)
- (1,11) 19. Clue (6)
- (8,11) 21. Clue (8)
- (1,13) 23. Clue (8)
- (10,13) 24. Clue (6)
- (1,15) 25. Clue (6)
- (8,15) 26. Clue (8)
down:
- (2,1) 2. Clue (6)
- (4,1) 3. Clue (5)
- (6,1) 4. Clue (9)
- (8,1) 5. Clue (7)
- (10,1) 6. Clue (5)
- (12,1) 7. Clue (9)
- (14,1) 8. Clue (8)
- (4,7) 13. Clue (9)
- (10,7) 14. Clue (9)
- (2,8) 15. Clue (8)
- (8,9) 17. Clue (7)
- (14,10) 18. Clue (6)
- (6,11) 20. Clue (5)
- (12,11) 22. Clue (5)`,

`name: QuickSlow grid4 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (1,1) 1. Clue (6)
- (8,1) 4. Clue (8)
- (1,3) 9. Clue (5)
- (7,3) 10. Clue (9)
- (1,5) 11. Clue (7)
- (9,5) 12. Clue (7)
- (1,7) 13. Clue (4)
- (6,7) 14. Clue (8)
- (3,9) 17. Clue (8)
- (12,9) 19. Clue (4)
- (1,11) 22. Clue (7)
- (9,11) 24. Clue (7)
- (1,13) 25. Clue (9)
- (11,13) 26. Clue (5)
- (1,15) 27. Clue (8)
- (10,15) 28. Clue (6)
down:
- (1,1) 1. Clue (8)
- (3,1) 2. Clue (9)
- (5,1) 3. Clue (6)
- (9,1) 5. Clue (13)
- (11,1) 6. Clue (7)
- (13,1) 7. Clue (5)
- (15,1) 8. Clue (6)
- (7,3) 10. Clue (13)
- (13,7) 15. Clue (9)
- (15,8) 16. Clue (8)
- (5,9) 18. Clue (7)
- (1,10) 20. Clue (6)
- (11,10) 21. Clue (6)
- (3,11) 23. Clue (5)`,

`name: QuickSlow grid5 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (1,1) 1. Clue (5)
- (8,1) 5. Clue (8)
- (1,3) 9. Clue (8)
- (10,3) 10. Clue (6)
- (1,5) 11. Clue (8)
- (10,5) 12. Clue (6)
- (4,7) 13. Clue (8)
- (1,8) 15. Clue (4)
- (12,8) 17. Clue (4)
- (5,9) 19. Clue (8)
- (1,11) 20. Clue (6)
- (8,11) 21. Clue (8)
- (1,13) 22. Clue (6)
- (8,13) 23. Clue (8)
- (1,15) 24. Clue (8)
- (10,15) 25. Clue (6)
down:
- (2,1) 2. Clue (8)
- (4,1) 3. Clue (8)
- (6,1) 4. Clue (9)
- (8,1) 5. Clue (15)
- (11,1) 6. Clue (7)
- (13,1) 7. Clue (8)
- (15,1) 8. Clue (8)
- (10,7) 14. Clue (9)
- (1,8) 15. Clue (8)
- (3,8) 16. Clue (8)
- (12,8) 17. Clue (8)
- (14,8) 18. Clue (8)
- (5,9) 19. Clue (7)`,

`name: QuickSlow grid6 2018/03/01
author: QuickSlow
size: 15x15
pubdate: 2018/03/01
across:
- (3,1) 1. Clue (12)
- (1,3) 9. Clue (5)
- (7,3) 10. Clue (9)
- (1,5) 11. Clue (9)
- (11,5) 12. Clue (5)
- (1,7) 13. Clue (9)
- (11,7) 16. Clue (5)
- (1,9) 18. Clue (5)
- (7,9) 19. Clue (9)
- (1,11) 20. Clue (5)
- (7,11) 22. Clue (9)
- (1,13) 25. Clue (9)
- (11,13) 26. Clue (5)
- (1,15) 27. Clue (12)
down:
- (3,1) 1. Clue (9)
- (5,1) 2. Clue (5)
- (7,1) 3. Clue (5)
- (9,1) 4. Clue (9)
- (11,1) 5. Clue (9)
- (13,1) 6. Clue (5)
- (1,2) 7. Clue (13)
- (15,2) 8. Clue (13)
- (5,7) 14. Clue (9)
- (7,7) 15. Clue (9)
- (13,7) 17. Clue (9)
- (3,11) 21. Clue (5)
- (9,11) 23. Clue (5)
- (11,11) 24. Clue (5)`
  ];

  function findMatchingQuickSlowTemplate( quickSlowObj ){
    // create CSV string of across clue ids
    // loop over each QuickSlowTemplateYamls
    //   parseDSL of template into obj
    //   create CSV string of template's across clue ids
    //   if csvs from quickSlowObj and template match, return the template object
    // if no match, return null.

    const quickSlowObjCSV = quickSlowObj.across.map( clue => clue.id ).join(',');
    for(let templateYaml of QuickSlowTemplateYamls){
      const templateObj = parseDSL( templateYaml );
      if (templateObj.errors.length > 0) {
        console.log("ERROR: findMatchingQuickSlowTemplate: could not parseDSL templateYaml");
        return null; // code failure
      }
      const templateCSV = templateObj.across.map( clue => clue.id ).join(',');
      if (quickSlowObjCSV === templateCSV) {
        return templateObj;
      }
    }

    return null; // no template match found
  }

  function mergeQuickSlowObjAndTemplate( quickSlowObj, templateObj ){
    // merge template into quickSlowObj

    // copy across individual fields
    quickSlowObj.dimensions = templateObj.dimensions;

    // copy across clue fields
    for( let direction of ['across', 'down']){
      quickSlowObj[direction].map( (clue, i) => {
        clue.coordinates = templateObj[direction][i].coordinates;
      })
    }

    return quickSlowObj;
  }

  function parseQuickSlowIntoDSLAndErrors( text ){
    let dslText = "duff output from parser";

    // scan in the text to get clues: id, body, length
    const quickSlowObj = parseQuickSlowIntoObj( text );
    // console.log(`parseQuickSlowIntoDSL: quickSlowObj=${JSON.stringify(quickSlowObj, null, 2)}`);

    // decide which template matches
    const templateObj = findMatchingQuickSlowTemplate( quickSlowObj );
    // console.log(`parseQuickSlowIntoDSL: templateObj=${JSON.stringify(templateObj, null, 2)}`);

    // merge clues with template
    const quickSlowCrosswordObj = mergeQuickSlowObjAndTemplate( quickSlowObj, templateObj );
    // console.log(`parseQuickSlowIntoDSL: quickSlowCrosswordObj=${JSON.stringify(quickSlowCrosswordObj, null, 2)}`);

    // convert to DSL
    dslText = generateDSL( quickSlowCrosswordObj, false /* withAnswers */ );
    // console.log(`parseQuickSlowIntoDSL: dslText=${dslText}`);

    return {
      dslText,
      errors: quickSlowObj.errors
    }
  }

  // given some text, decide what format it is,
  // and parse it accordingly,
  // If it mentions Quick Slow then assume its one of them.
  // If the input text indicates it is XML,
  //  check it is CrosswordCompiler XML, else error.
  // If it is CrosswordCompiler XML, attempt to parse it into DSL,
  //  and if that produces no errors, pass it to the DSL parser.
  // Generating the grid text and output format if there are no errors,
  // returning the crossword object with all the bits (or the errors).
  function parseWhateverItIs(text) {
    let possibleDSLText;
    let errors = [];
    if( text.match(/Quick Slow/) ) {
      console.log(`parseWhateverItIs: we haz Quick Slow`);
      let dslAndErrors = parseQuickSlowIntoDSLAndErrors( text );
      errors = dslAndErrors.errors;
      possibleDSLText = dslAndErrors.dslText;
    }
    else if (! text.match(/^\s*<\?xml/)) {
      console.log(`parseWhateverItIs: we haz no xml`);
      possibleDSLText = text;
    } else {
      console.log(`parseWhateverItIs: we haz xml`);
      if (! text.match(/<crossword-compiler/)) {
        errors = [ 'ERROR: input appears to be non-Crossword-Compiler XML' ];
      } else {
        console.log(`parseWhateverItIs: we haz crossword-compiler xml`);
        const possibleDSLTextWithErrors = ccwParseXMLIntoDSL( text );
        // expecting {
        //   dslText: "YAML text spec",
        //   errors: []
        // }
        console.log(`parseWhateverItIs: via ccwParseXMLIntoDSL, possibleDSLTextWithErrors=${JSON.stringify(possibleDSLTextWithErrors, null, 2)}`);

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
