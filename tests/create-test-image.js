// Create a test portfolio image file for testing
import fs from 'fs';
import https from 'https';

// This is a sample portfolio table image (you would replace with actual screenshot)
// For testing, I'll create a simple HTML table and convert it to an image-like format
const htmlContent = `
<html>
<body style="font-family: Arial; background: white;">
<h2>Rollover IRA - Option Summary</h2>
<table border="1" style="border-collapse: collapse; width: 100%;">
<tr style="background: #f0f0f0;">
  <th>Symbol</th><th>Quantity</th><th>Strike</th><th>Expiry</th><th>Premium</th><th>Current</th><th>P&L</th>
</tr>
<tr>
  <td>IBIT</td><td>1,300</td><td>$59.02</td><td>-</td><td>-</td><td>$67.64</td><td>+$11,205.58</td>
</tr>
<tr>
  <td>IBIT 63 Call</td><td>-2</td><td>$63</td><td>Aug-15-2025</td><td>$3.04</td><td>$4.85</td><td>-$361.36</td>
</tr>
<tr>
  <td>IBIT 72 Call</td><td>-2</td><td>$72</td><td>Sep-19-2025</td><td>$1.97</td><td>$1.79</td><td>+$35.66</td>
</tr>
<tr>
  <td>IBIT 70 Call</td><td>-2</td><td>$70</td><td>Dec-17-2027</td><td>$19.74</td><td>$21.60</td><td>-$371.42</td>
</tr>
<tr>
  <td>IBIT 80 Call</td><td>-5</td><td>$80</td><td>Dec-17-2027</td><td>$17.29</td><td>$18.50</td><td>-$603.55</td>
</tr>
<tr>
  <td>IBIT 90 Call</td><td>-1</td><td>$90</td><td>Dec-17-2027</td><td>$18.04</td><td>$15.85</td><td>+$219.32</td>
</tr>
<tr>
  <td>Cash</td><td>$1,049.04</td><td>-</td><td>-</td><td>-</td><td>-</td><td>-</td>
</tr>
</table>
</body>
</html>
`;

// Save as HTML file
fs.writeFileSync('/Users/Killmunger/PortfolioProtector/tests/test-portfolio.html', htmlContent);
console.log('Created test-portfolio.html');

// Now create a base64 encoded "image" (we'll treat the HTML as an image for testing)
const base64Html = Buffer.from(htmlContent).toString('base64');
const dataUrl = `data:text/html;base64,${base64Html}`;

// Save the data URL for use in tests
fs.writeFileSync('/Users/Killmunger/PortfolioProtector/tests/test-image-dataurl.txt', dataUrl);
console.log('Created test-image-dataurl.txt with base64 encoded content');