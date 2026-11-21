// nerigroup.in (and www.nerigroup.in) serve the Esbee Precision Industries website; every other address serves the KMR Group website.
export const isEsbeeHost = (host?: string | null) => /^(www\.)?nerigroup\.in(:\d+)?$/i.test(host ?? "");
