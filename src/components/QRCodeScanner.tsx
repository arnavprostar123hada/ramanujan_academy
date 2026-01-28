import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Camera, X, ScanLine } from "lucide-react";

interface QRCodeScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export const QRCodeScanner = ({ onScan, onClose }: QRCodeScannerProps) => {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;
        setIsScanning(true);

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {
            // Ignore scan errors (no QR found in frame)
          }
        );
      } catch (err) {
        setError("Unable to access camera. Please check permissions.");
        setIsScanning(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch (e) {
        // Ignore stop errors
      }
    }
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanLine className="w-5 h-5" />
            Scan QR Code
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-5 h-5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="text-center py-8">
              <Camera className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-destructive">{error}</p>
              <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          ) : (
            <>
              <div 
                id="qr-reader" 
                ref={containerRef}
                className="w-full rounded-lg overflow-hidden"
              />
              {isScanning && (
                <p className="text-sm text-center text-muted-foreground">
                  Position the QR code within the frame
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
