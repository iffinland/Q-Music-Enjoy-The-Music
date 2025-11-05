
import * as RadixSlider from '@radix-ui/react-slider';

interface SlideProps {
  value?: number;
  onChange?: (value: number) => void;
  styles?: object;
  max?: number;
  step?: number;
  ariaLabel?: string;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

const Slider: React.FC<SlideProps> = ({
  value = 1,
  onChange,
  styles = {},
  max = 1,
  step = 0.1,
  ariaLabel = 'Slider',
  disabled = false,
  orientation = 'horizontal',
}) => {
  const handleChange = (newValue: number[]) => {
    onChange?.(newValue[0]);
  };

  const isVertical = orientation === 'vertical';

  return ( 
    <RadixSlider.Root
      className={`relative flex select-none touch-none ${
        isVertical ? 'h-full w-10 flex-col items-center' : 'h-10 w-full items-center'
      }`}
      style={styles}
      orientation={orientation}
      defaultValue={[value]}
      value={[value]}
      onValueChange={handleChange}
      max={max}
      step={step}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      <RadixSlider.Track
        className={`
          bg-sky-900/60 
          relative 
          grow 
          rounded-full 
          ${isVertical ? 'w-[3px] h-full self-center' : 'h-[3px] w-full'}
        `}
      >
        <RadixSlider.Range
          className={`
            absolute 
            bg-sky-500 
            rounded-full 
            ${isVertical ? 'w-full' : 'h-full'}
          `}
        />
      </RadixSlider.Track>
    </RadixSlider.Root>
  );
}
 
export default Slider;
