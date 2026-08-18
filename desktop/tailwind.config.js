export default {
  content: [
    './index.html',
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#101214',
        surface: '#171A1D',
        panel: '#1E2226',
        elevated: '#252A2F',
        border: '#343A40',
        'border-strong': '#4A525A',
        primary: '#00D1CE',
        'primary-hover': '#25DBD6',
        'primary-muted': '#0B3F40',
        text: '#E6E9EC',
        'text-muted': '#9AA3AB',
        'text-subtle': '#6F7881',
        success: '#67C587',
        info: '#5AA9FA',
        warn: '#E7C66A',
        debug: '#6F7881',
        danger: '#D87878',
        error: '#D87878',
      },
      borderRadius: {
        ui: '8px',
      },
    },
  },
  plugins: [],
};
