# Usage: rails runner script/import_nyt_clues.rb
# Imports NYT crossword clues for the past 2 years (from today)

require_relative '../app/services/nyt_crossword_scraper'
require 'date'

START_DATE = Date.today - (760 * 2)  # 2 years ago
END_DATE = Date.today - 760

puts "Importing NYT clues from #{START_DATE} to #{END_DATE}..."

total_imported = 0
(START_DATE..END_DATE).each do |date|
  formatted_date = date.strftime('%m-%d-%y')
  begin
    scraper = NytCrosswordScraper.new(formatted_date)
    imported = scraper.save_clues_to_database!(force: true)
    puts "#{date}: Imported #{imported} clues."
    total_imported += imported
  rescue => e
    puts "#{date}: Error - #{e.message}"
  end
  sleep 1 # Add a 1 second wait between scrapes
end

puts "Total clues imported: #{total_imported}"
