var CrosswordDisplay = (function() {

  const classForAlert = 'alert-condition';

  function getElementByClass(name) {
    return document.getElementsByClassName(name)[0];
  }

  function getElementById(id) {
    return document.getElementById(id);
  }

  // take the text in the textarea, parse it, generate the various views, write them
  function updateDisplay() {
    var text = getElementById('dsl').value;
    var crossword = CrosswordDSL.parseWhateverItIs( text );

    getElementById('update-button').classList.remove(classForAlert);

    { // update the spec display with the DSL or the errors
      let errorsElt      = getElementById('errors');
      let specElt        = getElementById('spec');
      let specAnswersElt = getElementById('spec-answers');

      let textElts = [errorsElt, specElt, specAnswersElt];

      var gridElt = getElementById('grid');

      // Apologies, uses same name for class of outer element, then id of inner element.
      // Make sure we reset the html for the o-crossword component,
      // because it generates its own wrapper elements when it constructs the crossword display
      for ( let cl of ['responsive-crossword', 'responsive-crossword-with-answers'] ){
        let crosswordSkeletonHTML = `
          <div class="o-crossword" data-o-component="o-crossword" data-o-crossword-data="" id="${cl}">
            <table class="o-crossword-table"></table>
            <ul class="o-crossword-clues"></ul>
          </div>
        `;
        let responsiveCrossElt = getElementByClass(cl);
        responsiveCrossElt.innerHTML = crosswordSkeletonHTML;
      }

      textElts.forEach(elt => {
        elt.value = "";
      });

      if (crossword.errors.length === 0) {

        errorsElt.classList.remove(classForAlert);
        specElt.value = crossword.DSLGeneratedFromDSLWithoutAnswers;
        specAnswersElt.value = crossword.DSLGeneratedFromDSLWithAnswers;

        gridElt.innerHTML = crossword.gridText;

        // apologies, uses same name for class of outer element, then id of inner element
        for ( let cl of ['responsive-crossword', 'responsive-crossword-with-answers'] ){
          let text = (cl === 'responsive-crossword') ? crossword.DSLGeneratedFromDSLWithoutAnswers : crossword.DSLGeneratedFromDSLWithAnswers;
          let oCrosswordElt = getElementById(cl);
          oCrosswordElt.setAttribute('data-o-crossword-data', text);
        }

        document.dispatchEvent(new CustomEvent('o.CrosswordDataUpdated'));

      } else { // sadly, errors, :-(

        errorsElt.classList.add(classForAlert);
        errorsElt.value = crossword.errors.join("\n");
        gridElt.innerHTML = "...";

      }
    }
  }

  // this is called from the main page when DOMContentLoaded
  function invoke(){
    console.log("invoked");
    updateDisplay();

    let buttonElt = getElementById('update-button');
    buttonElt.onclick = updateDisplay;

    let textAreaElt = getElementById('dsl');
    textAreaElt.oninput = function(){
      let buttonElt = getElementById('update-button');
      buttonElt.classList.add(classForAlert);
    };
  }

  return {
    invoke: invoke
  }
})();
