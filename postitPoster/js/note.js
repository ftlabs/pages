const POSTER_RATIO = 12.7/100;
const NOTE_RATIO = 7.6/12.7;

let Note = function() {
	let isDragging = false;
	let note = setNote();
	let offsetX, offsetY;

	function setNote() {
		const noteEl = document.createElement('article');
		noteEl.classList.add('note');
		noteEl.style.width = calcSize() + 'px';
		noteEl.style.height = calcSize() * NOTE_RATIO + 'px';
		noteEl.setAttribute('data-rotation', 0);
		noteEl.style.left = (window.innerWidth - calcSize())/2 + 'px';
		noteEl.style.top = document.body.scrollTop + (window.innerHeight + calcSize() * NOTE_RATIO)/2 + 'px';
		//TODO: convert initial pos to %;
		document.getElementById('poster').appendChild(noteEl);
		return noteEl;
	}

	note.addEventListener('mousedown', initDrag);
	note.addEventListener('dblclick', rotateNote);
	document.addEventListener('mousemove', dragNote);
	document.addEventListener('mouseup', () => isDragging = false );



	function initDrag(e) {
		isDragging = true;
		offsetX = e.x - e.target.getBoundingClientRect().left;
		offsetY = e.y - e.target.getBoundingClientRect().top;

		const notes = document.querySelectorAll('.note');
		if (notes.length > 0) {
			Array.from(notes).forEach(note => {
				note.style.zIndex = 0;
			});
		}

		e.target.style.zIndex = 1;
	}

	function dragNote(e) {
		if(!isDragging) return;

		let notePos = {
			left: getPositionBounds('horizontal', (e.pageX - offsetX)) / window.innerWidth * 100,
			top: getPositionBounds('vertical', (e.pageY - offsetY)) / document.documentElement.scrollHeight * 100
		};

		note.style.left = notePos.left + '%';
		note.style.top = notePos.top + '%';
	}

	function rotateNote(e) {
		let angle = (parseInt(e.target.getAttribute('data-rotation')) === 0)?-90:0;
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
}