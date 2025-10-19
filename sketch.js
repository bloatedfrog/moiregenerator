let img;
let canvas;
let numLinesSlider, separationSlider, thicknessSlider, hatchThresholdSlider; 
let numLinesValueSpan, sepValueSpan, thickValueSpan, hatchValueSpan; 
let bwMode = 'none'; // 'none', 'classic', 'highContrast', 'vintage', 'tramage'

const MAX_WIDTH = 800;
const MAX_HEIGHT = 600;
const DEFAULT_NUM_LINES = 100; 
const DEFAULT_LINE_SEP = 0; 
const DEFAULT_LINE_THICKNESS = 1.0; 
const DEFAULT_HATCH_THRESHOLD = 50; 

function resetImage() {
    bwMode = 'none';
    numLinesSlider.value(1); 
    separationSlider.value(0);
    thicknessSlider.value(0.0);
    hatchThresholdSlider.value(DEFAULT_HATCH_THRESHOLD);
    updateAllSliderDisplays();
    redraw();
}

function updateAllSliderDisplays() {
    let numLinesCurrentVal = float(numLinesSlider.value());
    let displayNumLinesVal = numLinesCurrentVal === 1 ? 0 : numLinesCurrentVal;
    numLinesValueSpan.html(displayNumLinesVal.toFixed(0));
    
    sepValueSpan.html(float(separationSlider.value()).toFixed(1));
    thickValueSpan.html(float(thicknessSlider.value()).toFixed(1));
    hatchValueSpan.html(float(hatchThresholdSlider.value()).toFixed(0)); 
}


function setup() {
    numLinesSlider = select('#numLines');
    separationSlider = select('#lineSeparation'); 
    thicknessSlider = select('#lineThickness');
    hatchThresholdSlider = select('#hatchThreshold');

    numLinesValueSpan = select('#numLinesValue');
    sepValueSpan = select('#sepValue');
    thickValueSpan = select('#thickValue');
    hatchValueSpan = select('#hatchValue');

    numLinesSlider.input(() => { updateAllSliderDisplays(); redraw(); });
    separationSlider.input(() => { updateAllSliderDisplays(); redraw(); });
    thicknessSlider.input(() => { updateAllSliderDisplays(); redraw(); });
    hatchThresholdSlider.input(() => { updateAllSliderDisplays(); redraw(); });

    select('#imageUploader').changed(handleFile);
    select('#downloadBtn').mousePressed(() => { addPressEffect(select('#downloadBtn')); downloadImage(); });

    select('#bwClassic').mousePressed(() => { bwMode = 'classic'; addPressEffect(select('#bwClassic')); redraw(); });
    select('#bwHighContrast').mousePressed(() => { bwMode = 'highContrast'; addPressEffect(select('#bwHighContrast')); redraw(); });
    select('#bwVintage').mousePressed(() => { bwMode = 'vintage'; addPressEffect(select('#bwVintage')); redraw(); });
    
    const bwButtonsContainer = select('#bw-buttons');
    const tramageButton = createButton('TRAMAGE BINAIRE');
    tramageButton.id('tramageBinaire');
    tramageButton.parent(bwButtonsContainer);
    
    tramageButton.mousePressed(() => {
        bwMode = 'tramage';
        addPressEffect(tramageButton); 
        // Force les paramètres de tramage à des valeurs visibles au clic
        numLinesSlider.value(DEFAULT_NUM_LINES); 
        thicknessSlider.value(DEFAULT_LINE_THICKNESS);
        updateAllSliderDisplays();
        redraw();
    });
    
    select('#resetAll').mousePressed(() => { 
        addPressEffect(select('#resetAll')); 
        resetImage(); 
    });


    const adjustButtons = selectAll('.adjust-btn');
    adjustButtons.forEach(button => {
        button.mousePressed(() => {
            addPressEffect(button); 
            adjustSliderValue(button.attribute('data-target'), float(button.attribute('data-step')));
        });
    });
    
    updateAllSliderDisplays();
    noLoop(); 
}

function handleFile(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            img = loadImage(e.target.result, imageLoaded);
        };
        reader.readAsDataURL(file);
    }
}

function imageLoaded() {
    select('#placeholder-text').style('display', 'none');

    let newW = img.width;
    let newH = img.height;
    const imgRatio = img.width / img.height;

    if (img.width > MAX_WIDTH || img.height > MAX_HEIGHT) {
        if (imgRatio > 1) { 
            newW = MAX_WIDTH;
            newH = MAX_WIDTH / imgRatio;
        } else { 
            newH = MAX_HEIGHT;
            newW = MAX_HEIGHT * imgRatio;
        }
    }

    if (!canvas) {
        canvas = createCanvas(newW, newH);
        canvas.parent('canvas-container');
        select('canvas').style('display', 'block');
    } else {
        resizeCanvas(newW, newH);
    }

    resetImage(); 
}

function draw() {
    if (!img) return;

    let tempImg = img.get();
    
    // CORRECTION CRITIQUE 1: Déterminer le fond et l'image d'analyse
    if (bwMode === 'tramage') {
        // Mode Tramage : Le fond est blanc, l'image originale n'est PAS affichée
        background(255); 
        tempImg.filter(GRAY); // L'image est convertie en N&B pour l'ANALYSE
    } else {
        // Autres modes (N&B spécifiques ou 'none'): L'image est affichée comme fond.
        applyBlackAndWhiteEffect(tempImg); // Applique le filtre N&B/Sépia si sélectionné
        image(tempImg, 0, 0, width, height);
    }

    // ÉTAPE 2: Tramage (Moiré)
    // L'effet s'applique si le mode est 'tramage' OU si les sliders moiré sont utilisés.
    if (bwMode === 'tramage' || float(thicknessSlider.value()) > 0.05) {
        // Si bwMode n'est PAS tramage, nous utilisons l'image d'analyse qui a déjà été filtrée en N&B.
        if (bwMode !== 'tramage' && bwMode === 'none') {
             // Si 'none' est actif, nous devons filtrer l'image pour l'analyse
             tempImg.filter(GRAY);
        }
        applyMoiréEffect(tempImg);
    }
}

function applyMoiréEffect(baseImg) {
    const totalLines = float(numLinesSlider.value());
    const thicknessBase = float(thicknessSlider.value());
    const additionalSpacing = float(separationSlider.value()); 
    const hatchSensitivity = float(hatchThresholdSlider.value()); 

    if (thicknessBase <= 0.05) { 
        return; 
    }

    let separationBase = height / totalLines;
    
    noStroke();
    fill(0);

    baseImg.loadPixels();

    let y = 0;
    const segmentWidth = 2; 

    while (y < height) {
        
        let currentY = y; 
        
        for (let x = 0; x < width; x += segmentWidth) {
            
            let imgX = floor(map(x, 0, width, 0, baseImg.width));
            let imgY = floor(map(currentY, 0, height, 0, baseImg.height));
            let idx = (imgX + imgY * baseImg.width) * 4;
            
            let brightness = baseImg.pixels[idx];
            
            let hatchFactor = map(brightness, 0, 255, 1, 0); 
            
            // Calcul de l'épaisseur effective
            let sensitivityFactor = (hatchSensitivity / 100);
            
            let currentThickness = thicknessBase * hatchFactor * sensitivityFactor * 2; 
            
            let finalThickness = currentThickness;

            // Ajout d'une très légère irrégularité pour l'aspect "fait main"
            finalThickness += random(-0.05, 0.05); 
            
            if (finalThickness > 0.1) {
                // Forcer une épaisseur minimale/maximale pour garantir la netteté et le contraste
                finalThickness = constrain(finalThickness, 0.1, thicknessBase * 1.5);

                rect(x, currentY, segmentWidth, finalThickness);
            }
        }
        
        y += separationBase + additionalSpacing;
    }
}

function applyBlackAndWhiteEffect(targetImg) {
    if (bwMode === 'none') {
        // Laisse l'image en couleur
        return; 
    }
    
    // Le mode 'tramage' est géré dans draw(), on gère les 3 modes N&B/Sépia ici
    
    targetImg.filter(GRAY); 
    targetImg.loadPixels();

    for (let i = 0; i < targetImg.pixels.length; i += 4) {
        let r = targetImg.pixels[i];
        let g = targetImg.pixels[i + 1];
        let b = targetImg.pixels[i + 2];
        let gray = (r + g + b) / 3;

        if (bwMode === 'classic') {
            let adjustedGray = constrain(map(gray, 0, 255, -20, 275), 0, 255); 
            targetImg.pixels[i] = adjustedGray;
            targetImg.pixels[i + 1] = adjustedGray;
            targetImg.pixels[i + 2] = adjustedGray;
            
        } else if (bwMode === 'highContrast') {
            let threshold = 128; 
            let binary = gray > threshold ? 255 : 0;
            targetImg.pixels[i] = binary;
            targetImg.pixels[i + 1] = binary;
            targetImg.pixels[i + 2] = binary;

        } else if (bwMode === 'vintage') {
            let sepiaR = gray + 2 * 30;
            let sepiaG = gray + 30;
            let sepiaB = gray - 30;
            
            targetImg.pixels[i] = constrain(sepiaR, 0, 255);
            targetImg.pixels[i + 1] = constrain(sepiaG, 0, 255);
            targetImg.pixels[i + 2] = constrain(sepiaB, 0, 255);
        }
    }
    targetImg.updatePixels();
}

function adjustSliderValue(targetId, step) {
    let slider = select(`#${targetId}`);
    let currentValue = float(slider.value());
    let newValue = currentValue + step;

    const minVal = float(slider.attribute('min'));
    const maxVal = float(slider.attribute('max'));
    newValue = constrain(newValue, minVal, maxVal);
    
    if (targetId === 'lineThickness' || targetId === 'lineSeparation') {
        newValue = round(newValue * 10) / 10;
    } else if (targetId === 'hatchThreshold' || targetId === 'numLines') {
        newValue = round(newValue);
    }

    slider.value(newValue);
    updateAllSliderDisplays();
    redraw();
}

function addPressEffect(element) {
    element.addClass('is-pressed');
    setTimeout(() => {
        element.removeClass('is-pressed');
    }, 150); 
}

function downloadImage() {
    if (img) {
        saveCanvas(canvas, 'image_moiré_modifiee', 'jpg');
    }
}