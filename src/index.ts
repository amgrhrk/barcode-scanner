type QuaggaJSStatic = import('./quagga').QuaggaJSStatic
type QuaggaJSResultObject = import('./quagga').QuaggaJSResultObject
declare const Quagga: QuaggaJSStatic

async function initQuagga(target: HTMLDivElement) {
	return new Promise<void>((resolve, reject) => {
		Quagga.init({
			numOfWorkers: 2,
			inputStream: {
				name: 'Live',
				type: 'LiveStream',
				target: target,
				constraints: screen.orientation.type === 'portrait-primary' ? {
					width: 480,
					height: 640,
					aspectRatio: 480 / 640
				} : {
					width: 640,
					height: 480,
					aspectRatio: 640 / 480
				}
			},
			decoder: {
				readers: ['upc_reader', 'ean_reader']
			}
		}, (err) => {
			if (err) {
				reject(err)
				return
			}
			document.querySelector<HTMLCanvasElement>('.drawingBuffer')!.style.display = 'none'
			Quagga.start()
			resolve()
		})
	})
}

class Filter {
	private static readonly barcodeToSkip = new Set<string>()

	static removeFalsePositive(data: QuaggaJSResultObject) {
		if (data.codeResult.decodedCodes.every(info => typeof info.error !== 'number' || info.error < 0.2)) {
			return data
		}
		return null
	}

	static debounce(data: QuaggaJSResultObject) {
		if (!Filter.barcodeToSkip.has(data.codeResult.code!)) {
			Filter.barcodeToSkip.add(data.codeResult.code!)
			setTimeout(() => {
				Filter.barcodeToSkip.delete(data.codeResult.code!)
			}, 2000)
			return data
		}
		return null
	}

	static apply(data: QuaggaJSResultObject, ...filters: ((data: QuaggaJSResultObject) => QuaggaJSResultObject | null)[]) {
		let result: QuaggaJSResultObject | null = data
		for (const filter of filters) {
			if (!result) {
				break
			}
			result = filter(result)
		}
		return result
	}
}

function printError(err: unknown) {
	const container = document.querySelector<HTMLDivElement>('.error')!
	const div = document.createElement('div')
	div.innerText = `${err}`
	container.appendChild(div)
}

function showHintBar(text: string, hoverTime = 2000, transitionDuration = 300) {
	const hintBar = document.createElement('div')
	hintBar.innerText = text
	hintBar.style.animation = `fade-in ${transitionDuration / 1000}s`
	hintBar.classList.add('hint-bar')
	document.body.appendChild(hintBar)
	setTimeout(() => hintBar.style.animation = ``, transitionDuration)
	setTimeout(() => hintBar.style.animation = `fade-in ${transitionDuration / 1000}s reverse`, hoverTime + transitionDuration)
	setTimeout(() => hintBar.remove(), hoverTime + transitionDuration * 2)
}

function registerButtons(barcodeCount: Map<string, number>) {
	const [csvButton] = document.querySelectorAll<HTMLButtonElement>('.button')
	csvButton.addEventListener('click', async () => {
		if (barcodeCount.size === 0) {
			return
		}
		try {
			const csvText = [...barcodeCount].map(entry => `${entry[0]},${entry[1]}`).join('\n')
			await navigator.clipboard.writeText(csvText)
			showHintBar('Copied!')
		} catch (err) {
			printError(err)
		}
	})
}

function appendResult(container: HTMLDivElement, data: QuaggaJSResultObject) {
	const li = document.createElement('li')
	li.innerText = data.codeResult.code!
	container.appendChild(li)
}

(async function main() {
	const barcodeContainer = document.querySelector<HTMLDivElement>('.barcode')!
	const beep = new Audio('./assets/beep.mp3')
	const barcodeCount = new Map<string, number>()
	try {
		await initQuagga(document.querySelector<HTMLDivElement>('#barcode-scanner')!)
		Quagga.onDetected(async (data) => {
			const result = Filter.apply(data, Filter.removeFalsePositive, Filter.debounce)
			if (result) {
				await beep.play()
				barcodeCount.set(result.codeResult.code!, (barcodeCount.get(result.codeResult.code!) || 0) + 1)
				appendResult(barcodeContainer, result)
			}
		})
		registerButtons(barcodeCount)
	} catch (err) {
		printError(err)
	}
})()