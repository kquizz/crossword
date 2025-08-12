# Usage: rails runner script/count_clues_by_length.rb
# Prints a count of clues grouped by answer length

require_relative '../app/models/clue'

puts "Counting clues by answer length..."

length_counts = Clue.select('DISTINCT answer, LENGTH(answer) AS len').group('len').count
length_counts.sort.each do |length, count|
  puts "Length #{length}: #{count} unique answers"
end
