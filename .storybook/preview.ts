import type { Preview } from '@storybook/sveltekit';
import '../src/app.css';

const preview: Preview = {
	parameters: {
		controls: {
			matchers: {
				color: /(background|color)$/i,
				date: /Date$/i
			},
			sort: 'requiredFirst'
		},
		docs: {
			argTypes: {
				sort: 'requiredFirst'
			}
		}
	},
	tags: ['autodocs'] // TODO: make the autodoc page change theme along with the app
};

export default preview;
