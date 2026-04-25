export interface Level {
  value: string;
  label: string;
  description: string;
}

export const LEVELS: Level[] = [
  {
    value: "elementary",
    label: "Elementary",
    description: "Grades 4–6",
  },
  {
    value: "middle",
    label: "Middle school",
    description: "Grades 7–8",
  },
  {
    value: "high_school",
    label: "High school",
    description: "Grades 9–12",
  },
  {
    value: "undergrad",
    label: "Undergraduate",
    description: "University level",
  },
  {
    value: "professional",
    label: "Professional",
    description: "Working professional",
  },
  {
    value: "expert",
    label: "Expert",
    description: "Deep specialist",
  },
];

export const DEFAULT_LEVEL = "high_school";
