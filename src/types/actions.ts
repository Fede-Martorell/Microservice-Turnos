export type ActionState = {
  message?: string;
  errors?: Record<string, string[] | undefined>;
  success?: boolean;
  link?: string;
};

export type FormAction = (
  previous: ActionState,
  formData: FormData,
) => Promise<ActionState>;
