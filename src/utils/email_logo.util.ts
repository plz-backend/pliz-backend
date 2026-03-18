/**
 * Get email logo URL
 * Returns full URL to logo for use in email templates
 */
export const getEmailLogoUrl = (logoType: 'main' | 'square' | 'icon' = 'main'): string => {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';
  
  const logoMap = {
    main: 'pliz-logo.png',
    square: 'pliz-logo-square.png',
    icon: 'pliz-icon.png',
  };

  return `${baseUrl}/assets/images/emails/${logoMap[logoType]}`;
};

/**
 * Get logo HTML for email templates
 */
export const getEmailLogoHtml = (
  logoType: 'main' | 'square' | 'icon' = 'main',
  alt: string = 'Pliz'
): string => {
  const logoUrl = getEmailLogoUrl(logoType);
  
  const dimensions = {
    main: { width: 200, height: 60 },
    square: { width: 100, height: 100 },
    icon: { width: 48, height: 48 },
  };

  const { width, height } = dimensions[logoType];

  return `
    <img 
      src="${logoUrl}" 
      alt="${alt}" 
      width="${width}" 
      height="${height}"
      style="display: block; margin: 0 auto; max-width: ${width}px;"
    />
  `;
};