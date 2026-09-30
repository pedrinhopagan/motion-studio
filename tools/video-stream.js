/** @param {string} url */
export async function connectFrameStream(url) {
	const socket = new WebSocket(url);
	await new Promise((resolve, reject) => {
		socket.addEventListener("open", resolve, { once: true });
		socket.addEventListener("error", () => reject(new Error("Não foi possível conectar ao encoder.")), { once: true });
	});

	/** @param {number} index @param {Uint8Array} bytes */
	async function send(index, bytes) {
		if (socket.readyState !== WebSocket.OPEN) {
			throw new Error("A conexão com o encoder foi encerrada.");
		}

		const packet = new Uint8Array(bytes.byteLength + 4);
		new DataView(packet.buffer).setUint32(0, index, true);
		packet.set(bytes, 4);
		await new Promise((resolve, reject) => {
			const closed = () => {
				socket.removeEventListener("message", received);
				reject(new Error("O encoder encerrou a conexão."));
			};
			const received = (event) => {
				socket.removeEventListener("close", closed);
				if (Number(event.data) !== index) {
					reject(new Error("O encoder confirmou um quadro fora de ordem."));
					return;
				}
				resolve();
			};
			socket.addEventListener("message", received, { once: true });
			socket.addEventListener("close", closed, { once: true });
			socket.send(packet);
		});
	}

	return { send, close: () => socket.close() };
}
