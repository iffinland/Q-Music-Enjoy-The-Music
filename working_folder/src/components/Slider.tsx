
import * as RadixSlider from '@radix-ui/react-slider';

interface SlideProps {
  value?: number;
  onChange?: (value: number) => void;
  styles?: object
}

const Slider: React.FC<SlideProps> = ({ 
  value = 1, 
  onChange,
  styles = {}
}) => {
  const handleChange = (newValue: number[]) => {
    onChange?.(newValue[0]);
  };

  return ( 
    <RadixSlider.Root
      className="
        relative 
        flex 
        items-center 
        select-none 
        touch-none 
        w-full 
        h-10
      "
      defaultValue={[1]}
      value={[value]}
      onValueChange={handleChange}
      max={1}
      step={0.1}
      aria-label="Volume"
      style={{
        ...styles
      }}
    >
      <RadixSlider.Track 
        className="
          bg-sky-900/60 
          relative 
          grow 
          rounded-full 
          h-[3px]
        "
      >
        <RadixSlider.Range 
          className="
            absolute 
            bg-sky-500 
            rounded-full 
            h-full
          " 
        />
      </RadixSlider.Track>
    </RadixSlider.Root>
  );
}
 
export default Slider;
