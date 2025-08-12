# Usage: rails runner script/update_clue_lengths.rb
# Updates the length column for all clues based on the length of the answer

require_relative '../app/models/clue'

puts "Updating clue lengths..."

Clue.find_each do |clue|
  new_length = clue.answer&.length || 0
  if clue.length != new_length
    clue.update(length: new_length)
    puts "Updated clue ##{clue.id}: length set to #{new_length}"
  end
end

puts "Done updating clue lengths."
