// fileDialogSafe.js
// This file creates a custom directive to handle file dialog issues

export default {
  install(app) {
    // Define a custom directive that makes file dialogs safe for modals
    app.directive('file-dialog-safe', {
      mounted(el) {
        if (el.tagName.toLowerCase() !== 'input' || el.type !== 'file') {
          console.warn('v-file-dialog-safe directive should only be used on file inputs');
          return;
        }
        
        // Create a wrapper that handles the file selection process
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';
        wrapper.style.display = 'inline-block';
        wrapper.style.width = '100%';
        
        // Clone the file input
        const originalInput = el;
        const clonedInput = originalInput.cloneNode(true);
        
        // Style the cloned input to be invisible but cover the whole area
        clonedInput.style.position = 'absolute';
        clonedInput.style.top = '0';
        clonedInput.style.left = '0';
        clonedInput.style.width = '100%';
        clonedInput.style.height = '100%';
        clonedInput.style.opacity = '0';
        clonedInput.style.cursor = 'pointer';
        clonedInput.style.zIndex = '2';
        
        // Create a visible button that looks like a file input
        const visibleButton = document.createElement('button');
        visibleButton.type = 'button';
        visibleButton.textContent = 'Select File';
        visibleButton.style.width = '100%';
        visibleButton.style.padding = '6px';
        visibleButton.style.border = '1px solid #ddd';
        visibleButton.style.borderRadius = '4px';
        visibleButton.style.backgroundColor = '#f8f8f8';
        visibleButton.style.textAlign = 'left';
        visibleButton.style.cursor = 'pointer';
        visibleButton.style.zIndex = '1';
        
        // Add a focus protector
        const focusProtector = document.createElement('div');
        focusProtector.style.position = 'fixed';
        focusProtector.style.top = '0';
        focusProtector.style.left = '0';
        focusProtector.style.width = '100%';
        focusProtector.style.height = '100%';
        focusProtector.style.zIndex = '9999';
        focusProtector.style.display = 'none';
        document.body.appendChild(focusProtector);
        
        // Transfer file selection from cloned input to original
        clonedInput.addEventListener('change', function(e) {
          if (clonedInput.files.length > 0) {
            // Display the selected filename
            visibleButton.textContent = clonedInput.files[0].name;
            
            // Create a new FileList-like object (not directly possible, so we use DataTransfer)
            const dt = new DataTransfer();
            for (let i = 0; i < clonedInput.files.length; i++) {
              dt.items.add(clonedInput.files[i]);
            }
            
            // Assign the files to the original input
            originalInput.files = dt.files;
            
            // Trigger change event on the original input
            const event = new Event('change', { bubbles: true });
            originalInput.dispatchEvent(event);
          } else {
            visibleButton.textContent = 'Select File';
          }
          
          // Remove the focus protector after a short delay
          setTimeout(() => {
            focusProtector.style.display = 'none';
          }, 300);
        });
        
        // When clicking the visible button
        visibleButton.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          // Show the focus protector to catch any stray clicks
          focusProtector.style.display = 'block';
          
          // Trigger the hidden file input
          clonedInput.click();
        });
        
        // Block clicks on the focus protector
        focusProtector.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          focusProtector.style.display = 'none';
          return false;
        });
        
        // Hide the original input
        originalInput.style.display = 'none';
        
        // Add elements to the DOM
        wrapper.appendChild(visibleButton);
        wrapper.appendChild(clonedInput);
        originalInput.parentNode.insertBefore(wrapper, originalInput);
        wrapper.appendChild(originalInput);
      }
    });
  }
};
