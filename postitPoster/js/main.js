function init() {
	var mode = getQueryStringValue("type");

	var add = document.querySelector('.button__add');
	var save = document.querySelector('.button__save');
	var poster = document.getElementById('poster');

		add.addEventListener('click', addNote);
	if (mode === "kiosk") {
		document.documentElement.classList.add("kiosk");
		add.style.display = 'none';
		save.style.display = 'none';
		getNoteDetails();
	} else {
		poster.style.height = window.innerWidth * 2 + 'px';	
		save.addEventListener('click', showKioskUrl);
		window.addEventListener('resize', handleResize);
	}
}

function addNote(event) {
	var note = new Note(event);
}

function getNoteDetails() {
	var notes = getQueryStringValue("notes").split('-');
	var paraHeight = document.querySelector('#poster > p').scrollHeight;

	for(var i = 0 ; i < notes.length; ++i) {
		var note = notes[i].split(';');
		addNote({top: note[0], left: note[1], paraHeight: paraHeight, orientation: note[2], type: 'kiosk'});
	}
}

function dataURItoBlob(dataURI) {
    // convert base64/URLEncoded data component to raw binary data held in a string
    var byteString;
    if (dataURI.split(',')[0].indexOf('base64') >= 0)
        byteString = atob(dataURI.split(',')[1]);
    else
        byteString = unescape(dataURI.split(',')[1]);

    // separate out the mime component
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

    // write the bytes of the string to a typed array
    var ia = new Uint8Array(byteString.length);
    for (var i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ia], {type:mimeString});
}

function handleResize(e) {
	var poster = document.getElementById('poster');
	if(!document.documentElement.classList.contains('kiosk')) {
		poster.style.height = window.innerWidth * 2 + 'px';	
	}

	var notes = document.querySelectorAll('.note');
	if (notes.length > 0) {
		Array.from(notes).forEach(note => {
			note.style.width = window.innerWidth * POSTER_RATIO + 'px';
			note.style.height = window.innerWidth * POSTER_RATIO * NOTE_RATIO + 'px';
		});
	}
}

function getQueryStringValue (key) {  
  return decodeURIComponent(window.location.search.replace(new RegExp("^(?:.*[&\\?]" + encodeURIComponent(key).replace(/[\.\+\*]/g, "\\$&") + "(?:\\=([^&]*))?)?.*$", "i"), "$1"));  
}

function showKioskUrl() {
	var showKioskUrl = window.location.href + '?type=kiosk&notes=' + getAllNotes();
	prompt('Copy this URL', showKioskUrl);
}

function getAllNotes() {
	var notes = document.querySelectorAll('.note');
	var noteData = [];

	Array.from(notes).forEach(function(note) {
		var orient = (note.getAttribute('data-rotation') === '0') ? 'h' : 'v';
		var data = note.style.top.slice(0, -1) + ';' + note.style.left.slice(0, -1) + ';' + orient;

		noteData.push(data);
	});

	return noteData.join('-');
}

document.addEventListener("DOMContentLoaded", init);