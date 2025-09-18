// Simple iframe ref helper that waits for dimensions before setting src
export const useIframeRef = (src) => (iframe) => {
  if (iframe && src) {
    const check = () => {
      const rect = iframe.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        iframe.src = src;
      } else {
        requestAnimationFrame(check);
      }
    };
    check();
  }
};
