import { __ } from '@wordpress/i18n'
/**
 * Barcode Scanner Component
 *
 * Handles barcode scanning functionality using the BarcodeDetector API.
 * Automatically fills the input field when a barcode is detected.
 *
 * Based on: https://github.com/tony-xlh/barcode-detection-api-demo/blob/main/scanner.js
 */
export class BarcodeScanner {
	/**
	 * @param {HTMLElement} wrapper - The wrapper element containing the scanner UI
	 * @param {Object} options - Configuration options
	 * @param {boolean} options.debug - Enable debug mode (shows polygons, SVG text, and click options). Default: false
	 */
	constructor(wrapper, options = {}) {
		this.wrapper = wrapper
		this.debug = options.debug || false
		this.isBarcodeDetectorAvailable = false
		this.barcodeDetector = null
		this.decoding = false
		this.localStream = null
		this.interval = null
		this.lastDetectedBarcode = null
		this.detectionCooldown = 1000 // Prevent multiple detections within 1 second

		// Cache DOM elements
		this.scannerContainer = wrapper.querySelector('.js-barecode-scan')
		this.home = wrapper.querySelector('.scanner-wrapper__choices')
		this.startButton = wrapper.querySelector('#startButton')
		this.camera = wrapper.querySelector('.camera')
		this.cameraSelect = wrapper.querySelector('#cameraSelect')
		this.svg = wrapper.querySelector('.js-polygon')
		this.resultContainer = wrapper.querySelector('#swal2-input')

		// Initialize event listeners
		this.initEventListeners()

		// Initialize barcode detector
		this.initBarcodeDetector()
	}

	/**
	 * Initialize event listeners
	 */
	initEventListeners() {
		// Start button click handler
		this.startButton.onclick = () => {
			if (!this.isBarcodeDetectorAvailable) {
				return
			}
			this.startScanning()
		}

		// Camera loaded event - start decoding when video is ready
		this.camera.addEventListener('loadeddata', () => this.onPlayed(), false)

		// Camera selection change handler
		this.cameraSelect.onchange = () => this.onCameraChanged()
	}

	/**
	 * Start the scanning process
	 */
	startScanning() {
		this.scannerContainer.style.display = ''
		this.home.style.display = 'none'
		this.loadDevicesAndPlay()
	}

	/**
	 * Initialize the BarcodeDetector API
	 * Checks if the browser supports barcode detection
	 */
	async initBarcodeDetector() {
		let barcodeDetectorUsable = false

		// Check if BarcodeDetector is available in the browser
		if ('BarcodeDetector' in window) {
			const formats = await window.BarcodeDetector.getSupportedFormats()
			if (formats.length > 0) {
				barcodeDetectorUsable = true
			}
		}

		if (barcodeDetectorUsable === true) {
			this.isBarcodeDetectorAvailable = true
			this.barcodeDetector = new window.BarcodeDetector()
		} else {
			alert(__('Barcode Detector is not supported by this browser. You can try to type the barcode manually.', 'acf-barcodescanner'))
			this.startButton.style.display = 'none'
			return
		}
	}

	/**
	 * Load available camera devices and start playing video
	 */
	loadDevicesAndPlay() {
		const constraints = { video: true, audio: false }

		navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
			this.localStream = stream
			this.cameraSelect.innerHTML = ''

			// Enumerate all available devices
			navigator.mediaDevices.enumerateDevices().then((devices) => {
				const cameraDevices = []
				let defaultIndex = 0
				let count = 0

				// Filter and add camera devices to the select dropdown
				for (let i = 0; i < devices.length; i++) {
					const device = devices[i]

					if (device.kind === 'videoinput') {
						cameraDevices.push(device)
						const label = device.label || `Camera ${count++}`
						this.cameraSelect.add(new Option(label, device.deviceId))

						// Prefer back camera if available
						if (label.toLowerCase().indexOf('back') !== -1) {
							defaultIndex = cameraDevices.length - 1
						}
					}
				}

				if (cameraDevices.length > 0) {
					this.cameraSelect.selectedIndex = defaultIndex
					this.play(cameraDevices[defaultIndex].deviceId)
				} else {
					alert('No camera detected.')
				}
			})
		})
	}

	/**
	 * Start playing video from the specified camera device
	 * @param {string} deviceId - The device ID of the camera to use
	 */
	play(deviceId) {
		this.stop()

		const constraints = deviceId
			? {
					video: { deviceId: deviceId },
					audio: false
				}
			: {
					video: true,
					audio: false
				}

		navigator.mediaDevices
			.getUserMedia(constraints)
			.then((stream) => {
				this.localStream = stream
				// Attach local stream to video element
				this.camera.srcObject = stream
			})
			.catch((err) => {
				alert(err.message)
			})
	}

	/**
	 * Stop the camera stream and clear intervals
	 */
	stop() {
		clearInterval(this.interval)
		try {
			if (this.localStream) {
				this.localStream.getTracks().forEach((track) => track.stop())
			}
		} catch (e) {
			alert(e.message)
		}
	}

	/**
	 * Handle camera selection change
	 */
	onCameraChanged() {
		const deviceId = this.cameraSelect.selectedOptions[0].value
		this.play(deviceId)
	}

	/**
	 * Called when video starts playing
	 * Updates SVG viewBox and starts barcode decoding
	 */
	onPlayed() {
		this.updateSVGViewBoxBasedOnVideoSize()
		this.startDecoding()
	}

	/**
	 * Update SVG viewBox to match video dimensions
	 */
	updateSVGViewBoxBasedOnVideoSize() {
		this.svg.setAttribute('viewBox', `0 0 ${this.camera.videoWidth} ${this.camera.videoHeight}`)
	}

	/**
	 * Start the barcode decoding interval
	 * Decodes at ~25fps (40ms interval)
	 */
	startDecoding() {
		clearInterval(this.interval)
		// 1000/25 = 40ms per frame
		this.interval = setInterval(() => this.decode(), 40)
	}

	/**
	 * Decode barcodes from the current video frame
	 */
	async decode() {
		if (this.decoding === false) {
			this.decoding = true
			const barcodes = await this.barcodeDetector.detect(this.camera)
			this.decoding = false
			this.drawOverlay(barcodes)
		}
	}

	/**
	 * Draw overlay polygons for detected barcodes and handle auto-fill
	 * @param {Array} barcodes - Array of detected barcode objects
	 */
	drawOverlay(barcodes) {
		this.svg.innerHTML = ''

		if (barcodes.length === 0) {
			return
		}

		// Process each detected barcode
		for (let i = 0; i < barcodes.length; i++) {
			const barcode = barcodes[i]

			// Check cooldown to prevent rapid multiple detections
			const now = Date.now()
			if (this.lastDetectedBarcode === barcode.rawValue && now - this.lastDetectionTime < this.detectionCooldown) {
				continue
			}

			// In debug mode, draw polygons and text overlays
			if (this.debug) {
				// Extract corner points for polygon drawing
				const cornerPoints = {
					x1: barcode.cornerPoints[0].x,
					x2: barcode.cornerPoints[1].x,
					x3: barcode.cornerPoints[2].x,
					x4: barcode.cornerPoints[3].x,
					y1: barcode.cornerPoints[0].y,
					y2: barcode.cornerPoints[1].y,
					y3: barcode.cornerPoints[2].y,
					y4: barcode.cornerPoints[3].y
				}

				// Create and append polygon overlay
				const points = this.getPointsData(cornerPoints)
				const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon')
				polygon.setAttribute('points', points)
				polygon.setAttribute('class', 'barcode-polygon')

				// Create and append text label
				const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
				text.innerHTML = barcode.rawValue
				text.setAttribute('x', cornerPoints.x1)
				text.setAttribute('y', cornerPoints.y1)
				text.setAttribute('fill', 'red')
				text.setAttribute('fontSize', '20')

				this.svg.append(polygon)
				this.svg.append(text)

				// In debug mode, add click handler to manually fill the field
				// (doesn't stop scanning, allowing multiple scans)
				polygon.addEventListener('click', () => {
					this.fillBarcodeValue(barcode.rawValue) // false = don't stop scanning
				})
			}

			// Auto-fill the input field and stop scanning (unless in debug mode)
			if (!this.debug) {
				this.autoFillBarcode(barcode.rawValue)
			}
		}
	}

	/**
	 * Fill the barcode value in the input field
	 * @param {string} barcodeValue - The detected barcode value
	 * @param {boolean} stopScanning - Whether to stop the camera stream after filling. Default: true
	 */
	fillBarcodeValue(barcodeValue) {
		// Update cooldown tracking
		this.lastDetectedBarcode = barcodeValue
		this.lastDetectionTime = Date.now()

		// Update the result container if it exists
		if (this.resultContainer) {
			this.resultContainer.value = barcodeValue
			// Trigger input event to ensure SweetAlert2 recognizes the change
			this.resultContainer.dispatchEvent(new Event('input', { bubbles: true }))
		}
	}

	/**
	 * Automatically fill the barcode value in the input field and stop scanning
	 * @param {string} barcodeValue - The detected barcode value
	 */
	autoFillBarcode(barcodeValue) {
		this.fillBarcodeValue(barcodeValue)
	}

	/**
	 * Convert corner points object to SVG points string
	 * @param {Object} points - Object containing x1, x2, x3, x4, y1, y2, y3, y4
	 * @returns {string} SVG points string
	 */
	getPointsData(points) {
		return `${points.x1},${points.y1} ${points.x2},${points.y2} ${points.x3},${points.y3} ${points.x4},${points.y4}`
	}
}

/**
 * Factory function for backward compatibility
 * @param {HTMLElement} wrapper - The wrapper element containing the scanner UI
 * @param {Object} options - Configuration options
 * @param {boolean} options.debug - Enable debug mode (shows polygons, SVG text, and click options). Default: false
 * @returns {BarcodeScanner} Instance of BarcodeScanner
 */
export const barcodeScanner = (wrapper, options = {}) => {
	return new BarcodeScanner(wrapper, options)
}
