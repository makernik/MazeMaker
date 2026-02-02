/**
 * MakerNik Maze Generator - Main Entry
 * 
 * Wires up UI controls and orchestrates maze generation + PDF export.
 */

// DOM elements
const ageRangeSelect = document.getElementById('age-range');
const mazeStyleSelect = document.getElementById('maze-style');
const themeSelect = document.getElementById('theme');
const quantitySlider = document.getElementById('quantity');
const quantityDisplay = document.getElementById('quantity-display');
const generateBtn = document.getElementById('generate-btn');
const statusEl = document.getElementById('status');

/**
 * Get current form values
 */
function getFormValues() {
  return {
    ageRange: ageRangeSelect.value,
    mazeStyle: mazeStyleSelect.value,
    theme: themeSelect.value,
    quantity: parseInt(quantitySlider.value, 10),
  };
}

/**
 * Update status message
 */
function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

/**
 * Handle quantity slider change
 */
quantitySlider.addEventListener('input', () => {
  quantityDisplay.textContent = quantitySlider.value;
});

/**
 * Handle generate button click
 */
generateBtn.addEventListener('click', async () => {
  const values = getFormValues();
  console.log('Generate clicked with values:', values);
  
  setStatus('Generating mazes...');
  generateBtn.disabled = true;

  try {
    // TODO: Implement maze generation and PDF export
    // For now, just log the values
    await new Promise(resolve => setTimeout(resolve, 500));
    setStatus(`Ready to generate ${values.quantity} maze(s) for ages ${values.ageRange}`);
  } catch (error) {
    console.error('Generation failed:', error);
    setStatus('Generation failed. Please try again.', true);
  } finally {
    generateBtn.disabled = false;
  }
});

// Initialize
console.log('MakerNik Maze Generator loaded');
