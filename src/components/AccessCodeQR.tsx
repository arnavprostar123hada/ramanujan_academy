import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, QrCode } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AccessCodeQRProps {
  code: string;
  name: string;
  type: "student" | "teacher";
  size?: number;
  showCard?: boolean;
}

export const AccessCodeQR = ({ 
  code, 
  name, 
  type, 
  size = 150,
  showCard = true 
}: AccessCodeQRProps) => {
  const { toast } = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast({ title: "Access code copied!" });
  };

  const handleDownload = () => {
    const svg = document.getElementById(`qr-${code}`)?.querySelector('svg');
    if (!svg) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      canvas.width = size;
      canvas.height = size;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL('image/png');
      
      const link = document.createElement('a');
      link.download = `${type}-qr-${name.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.href = pngUrl;
      link.click();
      
      URL.revokeObjectURL(url);
      toast({ title: "QR code downloaded!" });
    };
    img.src = url;
  };

  const qrContent = (
    <div id={`qr-${code}`} className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-lg shadow-sm">
        <QRCodeSVG 
          value={code} 
          size={size}
          level="H"
          includeMargin={false}
        />
      </div>
      <div className="text-center">
        <p className="font-mono text-lg font-bold tracking-wider">{code}</p>
        <p className="text-sm text-muted-foreground">{name}</p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-3 h-3 mr-1" />
          Save
        </Button>
      </div>
    </div>
  );

  if (!showCard) {
    return qrContent;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="w-4 h-4" />
          {type === "student" ? "Parent" : "Teacher"} Access QR
        </CardTitle>
      </CardHeader>
      <CardContent>
        {qrContent}
      </CardContent>
    </Card>
  );
};
