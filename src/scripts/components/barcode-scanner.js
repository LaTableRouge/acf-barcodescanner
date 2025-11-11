// https://github.com/tony-xlh/barcode-detection-api-demo/blob/main/scanner.js#L148
export const barcodeScanner = (wrapper) => {
	let isBarcodeDetectorAvailable = false
	let barcodeDetector
	let decoding = false
	let localStream
	let interval
	const scannerContainer = wrapper.querySelector('.js-barecode-scan')
	const home = wrapper.querySelector('.scanner-wrapper__choices')
	const startButton = wrapper.querySelector('#startButton')
	startButton.onclick = function () {
		if (!isBarcodeDetectorAvailable) {
			return
		}

		scannerContainer.style.display = ''
		home.style.display = 'none'
		loadDevicesAndPlay()
	}

	wrapper.querySelector('.camera').addEventListener('loadeddata', onPlayed, false)
	wrapper.querySelector('#cameraSelect').onchange = onCameraChanged
	initBarcodeDetector()

	async function initBarcodeDetector() {
		let barcodeDetectorUsable = false
		if ('BarcodeDetector' in window) {
			const formats = await window.BarcodeDetector.getSupportedFormats()
			if (formats.length > 0) {
				barcodeDetectorUsable = true
			}
		}

		if (barcodeDetectorUsable === true) {
			// alert('Barcode Detector supported!')
			isBarcodeDetectorAvailable = true
		} else {
			alert('Barcode Detector is not supported by this browser.')
			startButton.style.display = 'none'
			return
		}

		barcodeDetector = new window.BarcodeDetector()
	}

	function loadDevicesAndPlay() {
		const constraints = { video: true, audio: false }
		navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
			localStream = stream
			const cameraselect = wrapper.querySelector('#cameraSelect')
			cameraselect.innerHTML = ''
			navigator.mediaDevices.enumerateDevices().then(function (devices) {
				let count = 0
				const cameraDevices = []
				let defaultIndex = 0
				for (let i = 0; i < devices.length; i++) {
					const device = devices[i]

					if (device.kind == 'videoinput') {
						cameraDevices.push(device)
						const label = device.label || `Camera ${count++}`
						cameraselect.add(new Option(label, device.deviceId))

						if (label.toLowerCase().indexOf('back') != -1) {
							defaultIndex = cameraDevices.length - 1
						}
					}
				}

				if (cameraDevices.length > 0) {
					cameraselect.selectedIndex = defaultIndex
					play(cameraDevices[defaultIndex].deviceId)
				} else {
					alert('No camera detected.')
				}
			})
		})
	}

	function play(deviceId) {
		stop()
		let constraints = {}

		if (deviceId) {
			constraints = {
				video: { deviceId: deviceId },
				audio: false
			}
		} else {
			constraints = {
				video: true,
				audio: false
			}
		}

		navigator.mediaDevices
			.getUserMedia(constraints)
			.then(function (stream) {
				localStream = stream
				const camera = wrapper.querySelector('.camera')
				// Attach local stream to video element
				camera.srcObject = stream
			})
			.catch(function (err) {
				alert(err.message)
			})
	}

	function stop() {
		clearInterval(interval)
		try {
			if (localStream) {
				localStream.getTracks().forEach((track) => track.stop())
			}
		} catch (e) {
			alert(e.message)
		}
	}

	function onCameraChanged() {
		const cameraselect = wrapper.querySelector('#cameraSelect')
		const deviceId = cameraselect.selectedOptions[0].value
		play(deviceId)
	}

	function onPlayed() {
		updateSVGViewBoxBasedOnVideoSize()
		startDecoding()
	}

	function updateSVGViewBoxBasedOnVideoSize() {
		const camera = wrapper.querySelector('.camera')
		const svg = wrapper.querySelector('.js-polygon')
		svg.setAttribute('viewBox', '0 0 ' + camera.videoWidth + ' ' + camera.videoHeight)
	}

	function startDecoding() {
		clearInterval(interval)
		// 1000/25=40
		interval = setInterval(decode, 40)
	}

	async function decode() {
		if (decoding === false) {
			const video = wrapper.querySelector('.camera')
			decoding = true
			const barcodes = await barcodeDetector.detect(video)
			decoding = false
			drawOverlay(barcodes)
		}
	}

	// const svg = wrapper.querySelector('.js-polygon')
	// if (svg) {
	//   svg.addEventListener('click', (e) => {
	//     booksfetch(svg.querySelector('text').innerHTML)
	//   })
	// }

	function drawOverlay(barcodes) {
		const svg = wrapper.querySelector('.js-polygon')
		svg.innerHTML = ''
		for (let i = 0; i < barcodes.length; i++) {
			const barcode = barcodes[i]
			const lr = {}
			lr.x1 = barcode.cornerPoints[0].x
			lr.x2 = barcode.cornerPoints[1].x
			lr.x3 = barcode.cornerPoints[2].x
			lr.x4 = barcode.cornerPoints[3].x
			lr.y1 = barcode.cornerPoints[0].y
			lr.y2 = barcode.cornerPoints[1].y
			lr.y3 = barcode.cornerPoints[2].y
			lr.y4 = barcode.cornerPoints[3].y
			const points = getPointsData(lr)
			const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
			polygon.setAttribute('points', points)
			polygon.setAttribute('class', 'barcode-polygon')
			const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
			text.innerHTML = barcode.rawValue
			text.setAttribute('x', lr.x1)
			text.setAttribute('y', lr.y1)
			text.setAttribute('fill', 'red')
			text.setAttribute('fontSize', '20')
			svg.append(polygon)
			svg.append(text)

			polygon.addEventListener('click', () => {
				stop()

				const resultContainer = wrapper.querySelector('#swal2-input')
				if (resultContainer) {
					resultContainer.value = barcode.rawValue
				}
			})
		}
	}

	function getPointsData(lr) {
		let pointsData = lr.x1 + ',' + lr.y1 + ' '
		pointsData = pointsData + lr.x2 + ',' + lr.y2 + ' '
		pointsData = pointsData + lr.x3 + ',' + lr.y3 + ' '
		pointsData = pointsData + lr.x4 + ',' + lr.y4
		return pointsData
	}
}
