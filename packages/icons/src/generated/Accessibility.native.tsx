import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';

type IconProps = SvgProps & {
  size?: number | string;
  color?: string;
};
const Accessibility = ({
  size = 16,
  color = 'currentColor',
  ...props
}: IconProps) => (
  <Svg width={size} height={size} viewBox='0 0 24 24' fill={color} {...props}>
    <Path
      d='M19.1907 7.54503C19.6375 7.54503 20 7.91169 20 8.36356C20 8.81542 19.6375 9.18208 19.1907 9.18208H14.6965V15.5385L16.3502 19.8877C16.5106 20.3094 16.3028 20.7828 15.8859 20.9451C15.469 21.1073 15.0009 20.8971 14.8405 20.4754L12.9998 15.6362H11.3698L9.13935 20.5243C8.95216 20.9345 8.47144 21.1138 8.06583 20.9247C7.66026 20.7353 7.4829 20.2491 7.66996 19.8389L9.75291 15.274V9.18208H4.8093C4.36253 9.18208 4 8.81542 4 8.36356C4 7.91169 4.36253 7.54503 4.8093 7.54503H19.1907ZM12 2C13.241 2 14.2471 3.01752 14.2471 4.2727C14.2471 5.52787 13.241 6.5454 12 6.5454C10.759 6.5454 9.75291 5.52787 9.75291 4.2727C9.75291 3.01752 10.759 2 12 2Z'
      fill={color}
    />
  </Svg>
);
export default Accessibility;
