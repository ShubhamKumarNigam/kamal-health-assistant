import { AnalyserForm } from "@/components/AnalyserForm";
import { AppShell } from "@/components/AppShell";
export default function ImageUploadPage() {
    return (<AppShell description="Upload a patient report, PDF, document, JPEG, or X-ray image, add a query, and generate a cautious patient report." eyebrow="Care tools" title="Analyser">
      <AnalyserForm />
    </AppShell>);
}
