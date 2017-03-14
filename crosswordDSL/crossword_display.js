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

    { // update the spec display, with either the generated spec JSON,
      // or the generated DSL,
      // or the errors
      var specElt        = getElementById('spec');
      var specAnswersElt = getElementById('spec-answers');

      if (crossword.errors.length === 0) {
        specElt.classList.remove(classForAlert);
        specAnswersElt.classList.remove(classForAlert);
      } else {
        specElt.classList.add(classForAlert);
        specAnswersElt.classList.add(classForAlert);
      }
      if (crossword['generatedDSL']) {
        let errorsText = "";
        if (crossword.errors.length > 0) {
          errorsText = [
            "ERRORS found in generated DSL...",
            crossword.errors.join("\n"),
            "",
            "Generated DSL:",
            ""].join("\n");
        }
        specElt.value = "";
        specAnswersElt.value = errorsText + crossword['generatedDSL'];
      } else {
        specElt.value = crossword.specTextWithoutAnswers;
        specAnswersElt.value = crossword.specTextWithAnswers;
      }
    }

    {
      var gridElt = getElementById('grid');
      gridElt.innerHTML = crossword.gridText;
    }

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

    // If valid, inject the json crossword spec into the data-o-crossword-data attribute
    if (crossword.errors.length === 0) {
      // apologies, uses same name for class of outer element, then id of inner element
      for ( let cl of ['responsive-crossword', 'responsive-crossword-with-answers'] ){
        let text = (cl === 'responsive-crossword') ? crossword.specTextWithoutAnswers : crossword.specTextWithAnswers;
        let oCrosswordElt = getElementById(cl);
        oCrosswordElt.setAttribute('data-o-crossword-data', text);
      }

      document.dispatchEvent(new CustomEvent('o.CrosswordDataUpdated'));
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
