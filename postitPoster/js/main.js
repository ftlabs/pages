function init() {
	const add = document.querySelector('.button__add');
	add.addEventListener('click', addNote);

	const snap = document.querySelector('.button__snap');
	snap.addEventListener('click', snapPoster);

	const poster = document.getElementById('poster');
	poster.style.height = window.innerWidth * 2 + 'px';

	window.addEventListener('resize', handleResize);
}

function addNote() {
	const note = new Note();
}

function snapPoster() {
	const poster = document.getElementById('poster');

	const captureHeight = document.documentElement.scrollHeight;
	console.log(document.documentElement.scrollHeight);
	html2canvas(poster, {height: captureHeight, width: window.innerWidth}).then(canvas => {
		// console.log(canvas.toDataURL());
		// let blob = dataURItoBlob(canvas.toDataURL());
		// let obj = URL.createObjectURL(blob);

		const image = document.createElement('a');
		// image.setAttribute('href', blob);
		// image.setAttribute('download', 'FTLabs_poster');

		// image.click();

		image.setAttribute('href', canvas.toDataURL());
		image.setAttribute('target', '_blank');
		image.click();
	});
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
	const poster = document.getElementById('poster');
	poster.style.height = window.innerWidth * 2 + 'px';

	const notes = document.querySelectorAll('.note');
	if (notes.length > 0) {
		Array.from(notes).forEach(note => {
			note.style.width = window.innerWidth * POSTER_RATIO + 'px';
			note.style.height = window.innerWidth * POSTER_RATIO * NOTE_RATIO + 'px';
		});
	}
}

document.addEventListener("DOMContentLoaded", init);