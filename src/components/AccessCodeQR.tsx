import { QRCodeSVG } from "qrcode.react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, QrCode, Mail, MessageCircle } from "lucide-react";
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

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`${type === "student" ? "Parent" : "Teacher"} Portal Access Code`);
    const body = encodeURIComponent(
      `Hello,\n\nHere is your access code for the ${type === "student" ? "Parent" : "Teacher"} Portal:\n\nAccess Code: ${code}\nName: ${name}\n\nYou can use this code to login to the portal and view ${type === "student" ? "your child's" : "your"} information.\n\nBest regards,\nRamanujan Academy`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
    toast({ title: "Email client opened!" });
  };

  const handleWhatsAppShare = () => {
    const message = encodeURIComponent(
      `*${type === "student" ? "Parent" : "Teacher"} Portal Access*\n\n` +
      `Hello! Here is your access code for the ${type === "student" ? "Parent" : "Teacher"} Portal:\n\n` +
      `📋 *Access Code:* ${code}\n` +
      `👤 *Name:* ${name}\n\n` +
      `Use this code to login and view ${type === "student" ? "your child's academic" : "your class"} information.\n\n` +
      `- Ramanujan Academy`
    );
    window.open(`https://wa.me/?text=${message}`, '_blank');
    toast({ title: "WhatsApp opened!" });
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
      <div className="flex flex-wrap gap-2 justify-center">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="w-3 h-3 mr-1" />
          Save
        </Button>
        <Button variant="outline" size="sm" onClick={handleEmailShare}>
          <Mail className="w-3 h-3 mr-1" />
          Email
        </Button>
        <Button variant="outline" size="sm" onClick={handleWhatsAppShare} className="text-green-600 hover:text-green-700">
          <MessageCircle className="w-3 h-3 mr-1" />
          WhatsApp
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
