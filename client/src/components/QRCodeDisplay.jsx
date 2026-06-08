import { QRCodeSVG } from 'qrcode.react';

export default function QRCodeDisplay({ url, sessionId }) {
  return (
    <div className="bg-white rounded-xl p-4 flex flex-col items-center gap-2 shadow-lg">
      <QRCodeSVG
        value={url}
        size={168}
        bgColor="#ffffff"
        fgColor="#1e3a5f"
        level="M"
        includeMargin={false}
      />
      <div className="text-blue-900 font-black text-2xl tracking-widest font-mono">
        {sessionId}
      </div>
      <div className="text-blue-500 text-xs text-center break-all leading-tight">
        {url}
      </div>
    </div>
  );
}
