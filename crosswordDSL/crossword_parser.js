var CrosswordDSL = (function() {

  // Given the json text of a crossword spec, generate the equivalent DSL,
  // bailing as soon as an error is found.
  // Only enough error checking is done to ensure the DSL can be constructed,
  // since it is assumed the DSL will itself be checked subsequently
  // to see if it specifies a valid crossword.
  function parseJsonIntoDSL(text) {
    var dslLines = [];
    var errors   = [];
    var response = {
      errors : errors,
      dslText : "",
    };
    var json;

    function addError(e){
      errors.push( "ERROR: " + e );
    }

    function responseWithError(e) {
      errors.unshift('Assuming this is a JSON doc...');
      if (e) {
        addError( e );
      }
      return response;
    }

    try {
      json = JSON.parse(text);
    }
    catch(err) {
      return responseWithError( err.message );
    }

    // check the simple, single-value fields
    ['author','editor','publisher','copyright','date'].forEach( f => {
      if (f in json) {
        let name = f;
        if (f === 'date') {
          name = 'pubdate';
        }
        dslLines.push( name + ' ' + json[f] );
      } else {
        addError( `missing field: ${f}` );
      }
    });

    // check for the complex fields
    // except 'answers' (for now)
    ['size','grid','gridnums','clues'].forEach( f => {
      if (! (f in json) ) {
        addError( `missing field: ${f}` );
      }
    });

    if (errors.length > 0) {
      return responseWithError();
    }

    if (json.size.rows && json.size.cols) {
      dslLines.push(`size ${json.size.rows}x${json.size.cols}`);
    } else {
      return responseWithError('could not parse size rows and cols');
    }

    if (json.gridnums.length !== json.size.rows){
      return responseWithError('gridnums does not match size.rows');
    }

    let idCoordinates = {};

    for( let [r, row] of json.gridnums.entries() ) {
      if (row.length !== json.size.cols){
        return responseWithError(`gridnums row ${r+1} does not match size.cols`);
      }
      for( let [c, cell] of row.entries() ) {
        if(cell !== 0){
          if (cell in idCoordinates) {
            return responseWithError(`duplicate id in gridnums: [${r+1},${c+1}] ${cell}`);
          }
          idCoordinates[cell] = [c,r];
        }
      }
    }

    let answers;

    if (json.answers) {
      for( let grouping of ['across', 'down'] ) {
        if(! json.answers[grouping]){
          return responseWithError(`could not find answers.${grouping}`);
        }
      }

      answers = json.answers;
    }

    for( let grouping of ['across', 'down'] ) {
      if(! json.clues[grouping]){
        return responseWithError(`could not find clues.${grouping}`);
      }
      if(answers && (json.clues[grouping].length !== answers[grouping].length)) {
        return responseWithError(`mismatch between answers and clues in grouping ${grouping}`);
      }

      dslLines.push(grouping);

      for( let [i, c] of json.clues[grouping].entries()) {
        let id = c[0];
        if (! (id in idCoordinates)) {
          return responseWithError(`no gridnums value for clue ${id} ${grouping}`);
        }

        // there was a bug in the spec which seems to have resulted in some
        // instances containing a mix of integers and strings here,
        // so stripping out non integers
        let wordSizes = c[2].filter(Number.isInteger);

        // if we only have the answer sizes, mock up a string consisting entirely of Xs
        let answerCombined;
        if (answers) {
          answerCombined = answers[grouping][i];
        } else {
          answerCombined = wordSizes.map(s => 'X'.repeat(s) ).join('');
        }

        // then split the text into the correctly-sized words.
        let letters = answerCombined.split('');
        let words = wordSizes.map(s => letters.splice(0, s).join(''));
        let wordsCSV = words.join(',');

        let body = c[1];

        let clue = [
          `[${idCoordinates[id][0]+1},${idCoordinates[id][1]+1}]`,
          `${id}.`,
          body,
          `(${wordsCSV})`
        ].join(' ');

        dslLines.push(clue);
      }
    }

    if( errors.length > 0 ) {
      addError("having attempted to catch all the errors, should not reach this point with any remaining errors");
      return responseWithError();
    }

    response['dslText'] = dslLines.join("\n");

    return response;
  }

  // given the DSL, ensure we have all the relevant pieces,
  // and assume there will be subsequent checking to ensure they are valid
  function parseDSL(text){
    var crossword = {
      version : "standard v1",
       author : "",
       editor : "Colin Inman",
      publisher : "Financial Times",
      copyright : "2017, Financial Times",
      pubdate : "today",
     dimensions : "17x17",
       across : [],
         down : [],
       errors : [],
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
      // ignore blank lines
      if (line === "") { /* do nothing */ }
      else if (match = /^version\s+(.+)$/i               .exec(line) ) { crossword.version    = match[1]; }
      else if (match = /^title\s+(.+)$/i                 .exec(line) ) { crossword.title      = match[1]; }
      else if (match = /^author\s+(.+)$/i                .exec(line) ) { crossword.author     = match[1]; }
      else if (match = /^editor\s+(.+)$/i                .exec(line) ) { crossword.editor     = match[1]; }
      else if (match = /^copyright\s+(.+)$/i             .exec(line) ) { crossword.copyright  = match[1]; }
      else if (match = /^publisher\s+(.+)$/i             .exec(line) ) { crossword.publisher  = match[1]; }
      else if (match = /^id\s+(.+)$/i                    .exec(line) ) { crossword.id         = match[1]; }
      else if (match = /^pubdate\s+(\d{4}\/\d\d\/\d\d)$/i.exec(line) ) { crossword.pubdate    = match[1]; }
      else if (match = /^size\s+(15x15|17x17)$/i         .exec(line) ) { crossword.dimensions = match[1]; }
      else if (match = /^(across|down)$/i                .exec(line) ) { cluesGrouping        = match[1]; }
      else if (match = /^\[(\d+),(\d+)\]\s+(\d+)\.\s+(.+)\s+\(([A-Z,-]+)\)$/.exec(line) ) {
        if (! /(across|down)/.test(cluesGrouping)) {
          crossword.errors.push("ERROR: clue specified but no 'across' or 'down' grouping specified");
          break;
        } else {
          let clue = {
            coordinates : [ parseInt(match[1]), parseInt(match[2]) ],
                     id : parseInt(match[3]),
                   body : match[4],
              answerCSV : match[5],
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
    var answers = {
      across : [],
      down   : []
    };
    crossword.answers = answers;

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

        // check answer within bounds
        let words = clue.answerCSV.split(/[,-]/);
        let wordsString = words.join('');
        clue.wordsString = wordsString;
        if (wordsString.length > maxCoord) {
          clueError("answer too long for crossword");
          break;
        }
        answers[grouping].push(wordsString);

        clue.wordsLengths = words.map(function(w){
          return w.length;
        });

        let answerPieces = clue.answerCSV.split(/([A-Z]+|[,-])/);
        let answerSpecPieces = answerPieces.map(function(p){
          if (/[A-Z]+/.exec(p)) {
            return p.length;
          } else {
            return p;
          }
        });
        clue.answerSpec = answerSpecPieces.join('');

        // check answer + offset within bounds
        if(    (grouping==='across' && (wordsString.length + x - 1 > maxCoord))
          || (grouping==='down'   && (wordsString.length + y - 1 > maxCoord)) ){
          clueError("answer too long(" + grouping + ") for crossword from that coord");
          break;
        }

        // check answer does not clash with previous answers
        let step = (grouping==='across')? 1 : maxCoord;
        for (var i = 0; i < wordsString.length; i++) {
          let pos = (x-1) + (y-1)*maxCoord + i*step;
          if (grid[pos] === ' ') {
            grid[pos] = wordsString[i];
          } else if( grid[pos] !== wordsString[i] ) {
            clueError("letter " + (i+1) + " clashes with previous clues");
            break;
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
          title : crossword.title,
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
            id : crossword.id,
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
          clue.body,
          clue.wordsLengths,
        ];
        spec.clues[grouping].push(item);
      });
    });

    return spec;
  }

  // given some text, decide what format it is and parse it accordingly,
  // generating the grid text and output format if there are no errors,
  // returning the crossword object with all the bits (or the errors).
  function parseWhateverItIs(text) {
    var crossword;

    // a bit ugly, but if the text is probably JSON (i.e. starts with a '{'),
    // assume it is the JSON text of the spec, and parse it accordingly,
    // otherwise assume it is DSL

    if (text.startsWith('{')) {
      let parsedJson = parseJsonIntoDSL( text );
      if (parsedJson['errors'].length > 0) {
        crossword = {
          errors : parsedJson['errors']
        };
      } else {
        crossword = parseDSL(parsedJson.dslText);
        crossword['generatedDSL'] = parsedJson.dslText;
      }
    } else {
      crossword = parseDSL(text);
    }

    // only attempt to validate the crossword if no errors found so far
    if (crossword.errors.length == 0) {
      crossword = validateAndEmbellishCrossword(crossword);
      console.log("validated crossword=", crossword);
    } else {
      console.log("could not validate crossword=", crossword);
    }

    // generate the spec, and specTexts with and without answers
    var specTextWithoutAnswers = "";
    var specTextWithAnswers    = "";
    if (crossword.errors.length > 0) {
      specTextWithoutAnswers = crossword.errors.join("\n");
    } else {
      let spec = generateSpec(crossword);
      crossword.spec = spec;

      specTextWithAnswers = JSON.stringify(spec);
      delete spec['answers'];
      specTextWithoutAnswers = JSON.stringify(spec);
    }
    crossword.specTextWithAnswers    = specTextWithAnswers;
    crossword.specTextWithoutAnswers = specTextWithoutAnswers;

    crossword.gridText = generateGridText( crossword );

    return crossword;
  }

  return {
    parseWhateverItIs
  }
})();
