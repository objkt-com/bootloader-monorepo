// Simple iframe ref helper that waits for dimensions before setting src
export const useIframeRef = (src) => (iframe) => {
  if (iframe && src) {
    // Hide iframe initially to prevent flickering
    iframe.style.visibility = 'hidden';
    
    const check = () => {
      const rect = iframe.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        iframe.src = src;
        // Show iframe once content is loading
        iframe.style.visibility = 'visible';
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  }
};
