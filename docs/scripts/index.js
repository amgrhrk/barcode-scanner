"use strict";
async function initQuagga(target) {
    return new Promise((resolve, reject) => {
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
                reject(err);
                return;
            }
            document.querySelector('.drawingBuffer').style.display = 'none';
            Quagga.start();
            resolve();
        });
    });
}
class Filter {
    static removeFalsePositive(data) {
        if (data.codeResult.decodedCodes.every(info => typeof info.error !== 'number' || info.error < 0.2)) {
            return data;
        }
        return null;
    }
    static debounce(data) {
        if (!Filter.barcodeToSkip.has(data.codeResult.code)) {
            Filter.barcodeToSkip.add(data.codeResult.code);
            setTimeout(() => {
                Filter.barcodeToSkip.delete(data.codeResult.code);
            }, 2000);
            return data;
        }
        return null;
    }
    static apply(data, ...filters) {
        let result = data;
        for (const filter of filters) {
            if (!result) {
                break;
            }
            result = filter(result);
        }
        return result;
    }
}
Filter.barcodeToSkip = new Set();
function printError(err) {
    const container = document.querySelector('.error');
    const div = document.createElement('div');
    div.innerText = `${err}`;
    container.appendChild(div);
}
function showHintBar(text, hoverTime = 2000, transitionDuration = 300) {
    const hintBar = document.createElement('div');
    hintBar.innerText = text;
    hintBar.style.animation = `fade-in ${transitionDuration / 1000}s`;
    hintBar.classList.add('hint-bar');
    document.body.appendChild(hintBar);
    setTimeout(() => hintBar.style.animation = ``, transitionDuration);
    setTimeout(() => hintBar.style.animation = `fade-in ${transitionDuration / 1000}s reverse`, hoverTime + transitionDuration);
    setTimeout(() => hintBar.remove(), hoverTime + transitionDuration * 2);
}
function registerButtons(barcodeCount) {
    const [csvButton] = document.querySelectorAll('.button');
    csvButton.addEventListener('click', async () => {
        if (barcodeCount.size === 0) {
            return;
        }
        try {
            const csvText = [...barcodeCount].map(entry => `${entry[0]},${entry[1]}`).join('\n');
            await navigator.clipboard.writeText(csvText);
            showHintBar('Copied!');
        }
        catch (err) {
            printError(err);
        }
    });
}
function appendResult(container, data) {
    const li = document.createElement('li');
    li.innerText = data.codeResult.code;
    container.appendChild(li);
}
(async function main() {
    const barcodeContainer = document.querySelector('.barcode');
    const beep = new Audio('./assets/beep.mp3');
    const barcodeCount = new Map();
    try {
        await initQuagga(document.querySelector('#barcode-scanner'));
        Quagga.onDetected(async (data) => {
            const result = Filter.apply(data, Filter.removeFalsePositive, Filter.debounce);
            if (result) {
                await beep.play();
                barcodeCount.set(result.codeResult.code, (barcodeCount.get(result.codeResult.code) || 0) + 1);
                appendResult(barcodeContainer, result);
            }
        });
        registerButtons(barcodeCount);
    }
    catch (err) {
        printError(err);
    }
})();
