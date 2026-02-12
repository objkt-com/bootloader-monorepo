// https://gist.github.com/asidko/9c7064027039411a11323eaf7d8ea2a4

export const compress = async string => {
    const blobToBase64 = blob => new Promise((resolve, _) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(blob);
    });
    const byteArray = new TextEncoder().encode(string);
    const cs = new CompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(byteArray);
    writer.close();
    const blob = await new Response(cs.readable).blob();
    return blobToBase64(blob);
};

export const decompress = async base64string => {
    const bytes = Uint8Array.from(atob(base64string), c => c.charCodeAt(0));
    const cs = new DecompressionStream('gzip');
    const writer = cs.writable.getWriter();
    writer.write(bytes);
    writer.close();
    const arrayBuffer = await new Response(cs.readable).arrayBuffer();
    return new TextDecoder().decode(arrayBuffer);
};

function hasLocalStorage() {
    try {
        return typeof localStorage !== 'undefined' && !!localStorage;
    } catch {
        return false;
    }
}

export async function loadCachedOrDecompress({ key, version, compressed }) {
    if (hasLocalStorage()) {
        try {
            const cached = localStorage.getItem(key);
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed.v === version && typeof parsed.data === 'string') {
                    return parsed.data;
                }
            }
        } catch (_) {
            // ignore and fall through to decompress
        }
    }
    if (compressed) {
        const jsonString = await decompress(compressed);
        if (hasLocalStorage()) {
            try {
                localStorage.setItem(key, JSON.stringify({ v: version, data: jsonString }));
            } catch (_) {}
        }
        return jsonString;
    }
    return null;
}

export function saveUncompressed({ key, version, jsonString }) {
    if (hasLocalStorage()) {
        try {
            localStorage.setItem(key, JSON.stringify({ v: version, data: jsonString }));
        } catch (_) {}
    }
}