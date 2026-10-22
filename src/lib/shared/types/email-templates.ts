export interface EmailTemplateSummary {
	key: string;
	name: string;
	description: string;
	subject: string;
	variables: string[];
	/** True when the stored text differs from the built-in default. */
	customized: boolean;
	updatedAt: string;
}

export interface EmailTemplateDetail extends EmailTemplateSummary {
	htmlBody: string;
	/** Values the preview and test sends fill the variables with. */
	sample: Record<string, string>;
}
