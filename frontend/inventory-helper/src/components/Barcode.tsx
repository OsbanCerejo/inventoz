import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodeProps {
  value: string;
}

const Barcode: React.FC<BarcodeProps> = ({ value }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (canvasRef.current) {
      JsBarcode(canvasRef.current, value, {
        format: "CODE128",
        displayValue: true,
      });
    }
  }, [value]);

  return <canvas ref={canvasRef} />;
};

export default Barcode;
