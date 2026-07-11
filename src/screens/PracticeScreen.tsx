// Route target for /practice: mounts the real SRS-driven Practice stream
// (src/ui/Practice). Superseded the U12-shell rotator that just cycled every
// generator with no mastery/persistence.
import { Practice } from '../ui/Practice';
import { Screen } from '../ui/Screen';

export default function PracticeScreen() {
  return (
    <Screen testID="practice-screen">
      <Practice />
    </Screen>
  );
}
