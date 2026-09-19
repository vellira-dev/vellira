import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number | string;
  color?: string;
};
const Platforms = ({
  size = 16,
  color = 'currentColor',
  ...props
}: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox='0 0 24 24'
    fill={color}
    xmlns='http://www.w3.org/2000/svg'
    {...props}
  >
    <path
      d='M4.90039 15.9439L11.0996 19.0435V11.5552L4.90039 8.45564V15.9439ZM12.9004 11.5552V19.0435L19.0996 15.9439V8.45564L12.9004 11.5552ZM6.01172 6.99958L12 9.99372L17.9883 6.99958L12 4.00544L6.01172 6.99958ZM20.9004 16.4996C20.9004 16.8405 20.7072 17.1518 20.4023 17.3043L12.4023 21.3043C12.149 21.431 11.851 21.431 11.5977 21.3043L3.59766 17.3043C3.29275 17.1518 3.09961 16.8405 3.09961 16.4996V6.99958C3.09961 6.65869 3.29275 6.34735 3.59766 6.1949L11.5977 2.1949L11.6943 2.1529C11.9246 2.06974 12.1806 2.08403 12.4023 2.1949L20.4023 6.1949C20.7072 6.34735 20.9004 6.65869 20.9004 6.99958V16.4996Z'
      fill={color}
    />
  </svg>
);
export default Platforms;
