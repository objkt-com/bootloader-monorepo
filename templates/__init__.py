from pathlib import Path
from urllib.parse import quote

def get_fragments_from_template(directory):
    """
    Get fragments from template file with proper URL encoding.
    
    Args:
        directory: Directory path (string or Path object) containing the template file
        
    Returns:
        list: [frag_0, frag_1, frag_2] where:
            - frag_0: Data URI with URL-encoded SVG content after the data URI prefix
            - frag_1: Completely URL-encoded fragment
            - frag_2: Completely URL-encoded fragment
    """
    # Convert to Path object for better path handling
    template_dir = Path(directory)
    template_file = template_dir / 'template'
    
    # Read the template file
    with open(template_file, 'r', encoding='utf-8') as f:
        template_content = f.read()
    
    # Split the template into fragments
    frag_0, rest = template_content.split("SEED_PLACEHOLDER")
    frag_1, frag_2 = rest.split("CODE_PLACEHOLDER")
    
    # Process frag_0: URL encode only the part after the data URI
    if frag_0.startswith('data:'):
        # Find the comma that separates the data URI header from the content
        comma_index = frag_0.find(',')
        if comma_index != -1:
            data_uri_prefix = frag_0[:comma_index + 1]  # Include the comma
            svg_content = frag_0[comma_index + 1:]      # Content after the comma
            # URL encode the SVG content part
            encoded_svg_content = quote(svg_content, safe='')
            frag_0 = data_uri_prefix + encoded_svg_content
        else:
            # Fallback: if no comma found, encode the entire frag_0
            frag_0 = quote(frag_0, safe='')
    else:
        # If it doesn't start with 'data:', encode the entire fragment
        frag_0 = quote(frag_0, safe='')
    
    # URL encode frag_1 and frag_2 completely
    frag_1 = quote(frag_1, safe='')
    frag_2 = quote(frag_2, safe='')
    
    return [frag_0, frag_1, frag_2]
