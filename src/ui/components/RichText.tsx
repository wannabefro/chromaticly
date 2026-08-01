// Inline emphasis for authored teach copy (chromaticly-e3z.19). The design's own
// smart tip sets a stressed word bold and a quoted phrase italic, so both markers
// exist: `*term*` for a term or sign being named, `**word**` for spoken stress.

import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { fonts, type as typo } from '../theme';

const SPAN = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;

export interface RichTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}

export function RichText({ children, style, testID }: RichTextProps) {
  const parts = children.split(SPAN).filter((part) => part !== '');
  return (
    <Text style={style} testID={testID}>
      {parts.map((part, i) => {
        if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={styles.strong}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
          return (
            <Text key={i} style={styles.em}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  em: { fontFamily: fonts.uiItalic, fontStyle: 'italic' },
  strong: { fontFamily: typo.cardTitle.fontFamily },
});
