export class CanvasWEBGL2 {
    constructor(width, height, options = {}) {
        this.canvas = document.createElement('canvas');
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl = this.canvas.getContext('webgl2', options);
        if (!this.gl) {
            throw new Error('WebGL2 is not supported in this environment.');
        }
    }

    getContext() {
        return this.gl;
    }

    getCanvas() {
        return this.canvas;
    }

    appendTo(elt) {
        elt.appendChild(this.canvas);
    }

    setShader(vertexSource, fragmentSource) {
        const gl = this.gl;

        function compileShader(source, type) {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                const info = gl.getShaderInfoLog(shader);
                gl.deleteShader(shader);
                throw new Error('Could not compile shader:\n' + info);
            }
            return shader;
        }

        const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
        const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            throw new Error('Could not link program:\n' + info);
        }

        // Clean up shaders as they're linked into the program now
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);

        this.program = program;
        gl.useProgram(program);

        const vertices = new Float32Array([
            -1, -1,  0, 0,
            1, -1,  1, 0,
            -1,  1,  0, 1,
            -1,  1,  0, 1,
            1, -1,  1, 0,
            1,  1,  1, 1
        ]);

        // Create buffer
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        
        // Assume attribute locations: position (vec2) at location 0, texcoord (vec2) at location 1
        const posLoc = gl.getAttribLocation(program, 'a_position');
        const texLoc = gl.getAttribLocation(program, 'a_texcoord');
        // Position attribute
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
        // Texcoord attribute
        if (texLoc !== -1) {
            gl.enableVertexAttribArray(texLoc);
            gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 16, 8);
        }
        // Store buffer for later use if needed
        this._fullscreenBuffer = buffer;
    }

    setUniform(name, value, type = null) {
        const gl = this.gl;
        const program = this.program;
        if (!program) throw new Error('Shader program not set.');

        const location = gl.getUniformLocation(program, name);
        if (location == null) throw new Error(`Uniform "${name}" not found.`);

        // If type is not specified, try to infer from value
        if (!type) {
            if (typeof value === 'number') type = '1f';
            else if (Array.isArray(value)) {
                if (value.length === 1) type = '1f';
                else if (value.length === 2) type = '2fv';
                else if (value.length === 3) type = '3fv';
                else if (value.length === 4) type = '4fv';
                else throw new Error('Unsupported uniform array length.');
            } else {
                throw new Error('Unsupported uniform value type.');
            }
        }

        // Set uniform based on type
        switch (type) {
            case '1f': gl.uniform1f(location, value); break;
            case '1i': gl.uniform1i(location, value); break;
            case '2fv': gl.uniform2fv(location, value); break;
            case '3fv': gl.uniform3fv(location, value); break;
            case '4fv': gl.uniform4fv(location, value); break;
            case '1fv': gl.uniform1fv(location, value); break;
            case '2iv': gl.uniform2iv(location, value); break;
            case '3iv': gl.uniform3iv(location, value); break;
            case '4iv': gl.uniform4iv(location, value); break;
            default: throw new Error(`Unsupported uniform type: ${type}`);
        }
    }

    createTexture(name, unit = 0) {
        const gl = this.gl;
        if (!this._textures) this._textures = {};
        const texture = gl.createTexture();
        this._textures[name] = texture;

        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        const program = this.program;
        const samplerLocation = gl.getUniformLocation(program, name);
        if (samplerLocation !== null) {
            gl.useProgram(program);
            gl.uniform1i(samplerLocation, unit);
        }
        return texture;
    }

    updateTexture(name, image, unit = 0) {
        const gl = this.gl;
        if (!this._textures || !this._textures[name]) {
            throw new Error(`Texture "${name}" has not been created.`);
        }
        const texture = this._textures[name];
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    }

    render() {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._fullscreenBuffer);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        if (this._textures) {
            if (!this._boundTextures) this._boundTextures = [];
            let unit = 0;
            for (const name in this._textures) {
                const tex = this._textures[name];
                if (this._boundTextures[unit] !== tex) {
                    gl.activeTexture(gl.TEXTURE0 + unit);
                    gl.bindTexture(gl.TEXTURE_2D, tex);
                    this._boundTextures[unit] = tex;
                }
                unit++;
            }
        }
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}