var POSTER_RATIO = 12.7/100;
var NOTE_RATIO = 7.6/12.7;
var KIOSK_RATIO = 8.33;

var Note = function(kiosk) {
	var isDragging = false;
	var note = setNote(kiosk);
	var offsetX, offsetY;

	function setNote(kiosk) {
		var noteEl = document.createElement('article');
		noteEl.classList.add('note');
		noteEl.style.width = calcSize() + 'px';
		noteEl.style.height = calcSize() * NOTE_RATIO + 'px';
		noteEl.setAttribute('data-rotation', 0);

		if(kiosk) {
			noteEl.style.left = getLeftKioskRatio(kiosk.left);	
			noteEl.style.top = getTopKioskRatio(kiosk.top, kiosk.paraHeight);
			if(kiosk.orientation === 'v') {
				noteEl.style.transform = 'rotate(-90deg)';	
			}
		} else {
			noteEl.style.left = (window.innerWidth - calcSize())/2 + 'px';	
			noteEl.style.top = document.body.scrollTop + (window.innerHeight + calcSize() * NOTE_RATIO)/2 + 'px';	
		}
		document.getElementById('poster').appendChild(noteEl);
		return noteEl;
	}

	if(!kiosk) {	
		note.addEventListener('mousedown', initDrag);
		note.addEventListener('dblclick', rotateNote);
		document.addEventListener('mousemove', dragNote);
		document.addEventListener('mouseup', () => isDragging = false );	
	}



	function initDrag(e) {
		isDragging = true;
		offsetX = e.x - e.target.getBoundingClientRect().left;
		offsetY = e.y - e.target.getBoundingClientRect().top;

		var notes = document.querySelectorAll('.note');
		if (notes.length > 0) {
			Array.from(notes).forEach(note => {
				note.style.zIndex = 0;
			});
		}

		e.target.style.zIndex = 1;
	}

	function dragNote(e) {
		if(!isDragging) return;

		var notePos = {
			left: getPositionBounds('horizontal', (e.pageX - offsetX)) / window.innerWidth * 100,
			top: getPositionBounds('vertical', (e.pageY - offsetY)) / document.documentElement.scrollHeight * 100
		};

		note.style.left = notePos.left + '%';
		note.style.top = notePos.top + '%';
	}

	function rotateNote(e) {
		var angle = (parseInt(e.target.getAttribute('data-rotation')) === 0)?-90:0;
		e.target.style.transform = 'rotate('+ angle +'deg)';
		e.target.setAttribute('data-rotation', angle);
	}

	function calcSize() {
		return window.innerWidth*POSTER_RATIO;
	}

	function getPositionBounds (pos, value) {
		if(value < 0) {
			return 0;
		}

		switch(pos) {
			case 'vertical':
				if(value > document.documentElement.scrollHeight - note.offsetHeight) {
					return document.documentElement.scrollHeight - note.offsetHeight;
				}
			break;

			case 'horizontal':
				if(value > window.innerWidth - note.offsetWidth) {
					return window.innerWidth - note.offsetWidth;
				}
			break;
		}

		return value;
	}

	function getLeftKioskRatio(left){
		var l = Number(left);
		var ratio = (l/100 - 0.1)*window.innerWidth + 70;
		return ratio + 'px';
	}

	function getTopKioskRatio(top, height) {
		var t = Number(top);
		var h = Number(height);

		console.log(t-35.75);

		var ratio = 380 + (KIOSK_RATIO*(t - 35.75)/100)*h;

		return ratio + 'px';
	}
}