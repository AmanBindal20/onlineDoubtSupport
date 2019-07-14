$(document).ready(function () {
	// declare variables
	var $userTemplate, editors, socket, currentUser, canvas, context, pensize, colors;
	var current = {
		color: 'black',
		pensize: 2
	};
	var drawing = false;

	// assign variables
	$userTemplate = $('#userTemplate');
	editors = {};
	whiteBoards = {};

	// define functions
	function socketConnected() {
		currentUser = window.prompt("Your name please?");
		$('title').html(currentUser);
		socket.emit('user-joined', currentUser);
	}

	function userJoined(allUsers) {
		for (i = 0; i < allUsers.length; i++) {
			var otherUser = allUsers[i];

			if ($('div[user=' + otherUser + ']').length == 0 && otherUser !== currentUser) {
				var $div = $('<div />');
				$div.html($userTemplate.html());
				$div.attr('user', otherUser);
				$div.find('span[purpose=user-name]').html(otherUser);
				$div.find('div[purpose=editor]').attr('id', otherUser + "Editor");

				var boardId = otherUser + "WhiteBoard";
				$div.find('canvas[purpose=whiteboard]').attr('id', boardId);

				$('body').append($div);

				editors[otherUser] = ace.edit(otherUser + "Editor");
				editors[otherUser].setTheme("ace/theme/monokai");
				editors[otherUser].getSession().setMode("ace/mode/javascript");
				editors[otherUser].setReadOnly(true);
				editors[otherUser].getSession().on('change', sendEditorMessage);
				initCanvas($div, otherUser);



			}
		}
	}

	function initCanvas(containerId, otherUser) {

		canvas = $(containerId).find('.whiteboard')[0];
		colors = $(containerId).find('.color');
		pensize = $(containerId).find('.pensize');
		rubber = $(containerId).find('.rubber')[0];
		context = canvas.getContext('2d');

		whiteBoards[otherUser] = context;

		canvas.addEventListener('mousedown', onMouseDown, false);
		canvas.addEventListener('mouseup', onMouseUp, false);
		canvas.addEventListener('mouseout', onMouseUp, false);
		canvas.addEventListener('mousemove', throttle(onMouseMove, 10), false);

		//Touch support for mobile devices
		canvas.addEventListener('touchstart', onMouseDown, false);
		canvas.addEventListener('touchend', onMouseUp, false);
		canvas.addEventListener('touchcancel', onMouseUp, false);
		canvas.addEventListener('touchmove', throttle(onMouseMove, 10), false);

		for (var i = 0; i < colors.length; i++) {
			colors[i].addEventListener('click', onColorUpdate, false);
		}

		for (var i = 0; i < pensize.length; i++) {
			pensize[i].addEventListener('click', onPenSizeUpdate, false);
		}
		rubber.addEventListener('click', clearCanvas, false);

		window.addEventListener('resize', onResize, false);
		onResize();
	}

	function userLeft(otherUser) {
		$('div[user=' + otherUser + ']').remove();
		delete editors[otherUser];
	}

	function messageReceived(data) {
		switch (data.messageType) {
			case "chat":
				chatMessageReceived(data);
				break;
			case "control":
				controlMessageReceived(data);
				break;
			case "release":
				releaseMessageReceived(data);
				break;
			case "editor":
				editorMessageReceived(data);
				break;
			case "drawing":
				drawingDataReceived(data);
				break;
			default:
				break;
		}
	}

	function chatMessageReceived(data) {
		var $parentDiv, $li;

		if (data.to === 'public') {
			$parentDiv = $('div[user=public]');
		} else {
			$parentDiv = $('div[user=' + data.from + ']');
		}

		$li = $('<li />').html(data.message + ": " + data.from).addClass('left');
		$parentDiv.find('ul[purpose=chat]').append($li);
		$parentDiv.find('span[purpose=activity]').html("Chat");
	}

	function controlMessageReceived(data) {
		var $parentDiv, otherUser;

		if (data.to === 'public') {
			$parentDiv = $('div[user=public]');
			otherUser = 'public';
		} else {
			$parentDiv = $('div[user=' + data.from + ']');
			otherUser = data.from;
		}

		$parentDiv.find('span[purpose=controlled-by]').html(data.from);
		editors[otherUser].setReadOnly(true);
		$parentDiv.find('[action=control]').attr('disabled', 'disabled');
		$parentDiv.find('span[purpose=activity]').html("Control");
	}

	function releaseMessageReceived(data) {
		var $parentDiv, otherUser;

		if (data.to === 'public') {
			$parentDiv = $('div[user=public]');
			otherUser = 'public';
		} else {
			$parentDiv = $('div[user=' + data.from + ']');
			otherUser = data.from;
		}

		$parentDiv.find('span[purpose=controlled-by]').html('');
		editors[otherUser].setReadOnly(true);
		$parentDiv.find('[action=control]').removeAttr('disabled');
		$parentDiv.find('span[purpose=activity]').html("Release");
		socket.on('drawing', onDrawingEvent);
	}

	function editorMessageReceived(data) {
		var otherUser;

		if (data.to === 'public') {
			otherUser = 'public';
		} else {
			otherUser = data.from;
		}

		editors[otherUser].setValue(data.message);
		$parentDiv.find('span[purpose=activity]').html("Editor");
	}

	function drawingDataReceived(data) {
		var otherUser;

		if (data.to === 'public') {
			otherUser = 'public';
		} else {
			otherUser = data.from;
		}

		var otherContext = whiteBoards[otherUser];
		var w = canvas.width;
		var h = canvas.height;
		//drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, otherUser);

		var drawingData = data.message;
		x0 = drawingData.x0;
		y0 = drawingData.y0;

		y1 = drawingData.y1;
		x1 = drawingData.x1;
		//context = whiteBoards[otherUser];
		otherContext.beginPath();
		otherContext.moveTo(x0, y0);
		otherContext.lineTo(x1, y1);
		otherContext.strokeStyle = drawingData.color;
		otherContext.lineWidth = drawingData.pensize;
		otherContext.stroke();
		otherContext.closePath();

		//	$parentDiv.find('span[purpose=activity]').html("Drawing");
	}




	function sendChatMessage() {
		if (window.event.which === 13) {
			var otherUser = $('div.big span[purpose=user-name]').html();

			var message = $(this).val();
			$(this).val('');

			var $li = $('<li />').html(message + ": " + currentUser).addClass('right');
			$('div.big ul[purpose=chat]').append($li);

			socket.emit('message', {
				to: otherUser,
				from: currentUser,
				message: message,
				messageType: 'chat'
			});
		}
	}

	function sendControlMessage() {
		var otherUser = $('div.big span[purpose=user-name]').html();

		$('div.big span[purpose=controlled-by]').html(currentUser);
		editors[otherUser].setReadOnly(false);
		$('div.big [action=control]').attr('disabled', 'disabled');
		$('div.big [action=release]').removeAttr('disabled');

		socket.emit('message', {
			to: otherUser,
			from: currentUser,
			messageType: 'control'
		});

		return false;
	}

	function sendReleaseMessage() {
		var otherUser = $('div.big span[purpose=user-name]').html();

		$('div.big span[purpose=controlled-by]').html('');
		editors[otherUser].setReadOnly(true);
		$('div.big [action=control]').removeAttr('disabled');
		$('div.big [action=release]').attr('disabled', 'disabled');

		socket.emit('message', {
			to: otherUser,
			from: currentUser,
			messageType: 'release'
		});

		return false;
	}

	function sendEditorMessage(e) {
		var otherUser = $('div.big span[purpose=user-name]').html();

		if (editors[otherUser].curOp && editors[otherUser].curOp.command.name) {
			var message = editors[otherUser].getValue();

			socket.emit('message', {
				to: otherUser,
				from: currentUser,
				message: message,
				messageType: 'editor'
			});
		}
	}

	function showUser() {
		$(this).addClass('big');

		canvas = $(this).find('.whiteboard')[0];
		context = canvas.getContext('2d');
	}

	function dismissUser() {
		$(this).closest('div[user]').removeClass('big');
		return false;
	}

	//message related to drawing
	function drawLine(x0, y0, x1, y1, emit, otherContext) {
		x0 = x0 - 10;
		y0 = y0 - 90;

		y1 = y1 - 90;
		x1 = x1 - 10;
		//context = whiteBoards[otherUser];
		context.beginPath();
		context.moveTo(x0, y0);
		context.lineTo(x1, y1);
		context.strokeStyle = current.color;
		context.lineWidth = current.pensize;
		context.stroke();
		context.closePath();

		if (!emit) {
			return;
		}
		var w = canvas.width;
		var h = canvas.height;

		var message1 = {
			x0: x0,
			y0: y0,
			x1: x1,
			y1: y1,
			color: current.color,
			pensize: current.pensize
		};
		var otherUser = $('div.big span[purpose=user-name]').html();

		socket.emit('message', {
			to: otherUser,
			from: currentUser,
			message: message1,
			messageType: 'drawing'
		});
	}

	function onMouseDown(e) {

		offsetX = e.target.offsetLeft + e.offsetX;
		offsetY = e.target.offsetTop + e.offsetY;

		drawing = true;
		current.x = (e.clientX || e.touches[0].clientX);
		current.y = (e.clientY || e.touches[0].clientY);
	}

	function onMouseUp(e) {
		if (!drawing) {
			return;
		}
		drawing = false;
		drawLine(current.x, current.y, e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY,  true);
	}

	function onMouseMove(e) {
		if (!drawing) {
			return;
		}
		drawLine(current.x, current.y, e.clientX || e.touches[0].clientX, e.clientY || e.touches[0].clientY, true);
		current.x = e.clientX || e.touches[0].clientX;
		current.y = e.clientY || e.touches[0].clientY;
	}

	function onColorUpdate(e) {
		current.color = e.target.className.split(' ')[2];
	}

	function onPenSizeUpdate(e) {
		current.pensize = e.target.className.split(' ')[2];
	}

	// limit the number of events per second
	function throttle(callback, delay) {
		var previousCall = new Date().getTime();
		return function () {
			var time = new Date().getTime();

			if ((time - previousCall) >= delay) {
				previousCall = time;
				callback.apply(null, arguments);
			}
		};
	}

	function clearCanvas() {
		context.clearRect(0, 0, canvas.width, canvas.height);
	}

	
	// make the canvas fill its parent
	function onResize() {
		canvas.width = 400;
		canvas.height = 490;
	}

	// define Init
	function Init() {
		socket = io();

		socket.on("connect", socketConnected);
		socket.on('user-joined', userJoined);
		socket.on('user-left', userLeft);
		socket.on('message', messageReceived);

		$(document).on("keypress", "textarea[purpose=chat]", sendChatMessage);
		$(document).on("click", "a[action=control]:not([disabled])", sendControlMessage);
		$(document).on("click", "a[action=release]:not([disabled])", sendReleaseMessage);

		$(document).on("click", "div[user]", showUser);
		$(document).on("click", "span[action=dismiss]", dismissUser);
		userJoined(["public"]);
	}

	// Call Init
	Init();
});