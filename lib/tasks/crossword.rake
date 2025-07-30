namespace :crossword do
  desc "Scrape NYT crossword clues for a specific date (format: MM-DD-YY)"
  task :scrape_nyt_clues, [ :date ] => :environment do |t, args|
    date = args[:date] || Date.current.strftime("%m-%d-%y")

    puts "Starting NYT crossword scrape for date: #{date}"

    scraper = NytCrosswordScraper.new(date)
    count = scraper.save_clues_to_database!

    if count > 0
      puts "✅ Successfully scraped and saved #{count} clues!"
    end
    puts "Total clues in database: #{Clue.count}"
  end

  desc "Force re-scrape NYT crossword clues (overwrites existing)"
  task :force_scrape_nyt_clues, [ :date ] => :environment do |t, args|
    date = args[:date] || Date.current.strftime("%m-%d-%y")

    puts "Force scraping NYT crossword for date: #{date}"

    scraper = NytCrosswordScraper.new(date)
    count = scraper.save_clues_to_database!(force: true)

    puts "✅ Successfully scraped and saved #{count} clues!"
    puts "Total clues in database: #{Clue.count}"
  end

  desc "Scrape multiple days of NYT crosswords"
  task :scrape_date_range, [ :start_date, :end_date ] => :environment do |t, args|
    start_date = Date.parse(args[:start_date])
    end_date = Date.parse(args[:end_date])

    total_saved = 0

    (start_date..end_date).each do |date|
      formatted_date = date.strftime("%m-%d-%y")
      puts "\n📅 Scraping #{formatted_date}..."

      scraper = NytCrosswordScraper.new(formatted_date)
      count = scraper.save_clues_to_database!
      total_saved += count

      # Be nice to the server
      sleep 1
    end

    puts "\n🎉 Finished! Total clues saved: #{total_saved}"
    puts "Total clues in database: #{Clue.count}"
  end

  desc "Test scraper without saving to database"
  task :test_scraper, [ :date ] => :environment do |t, args|
    date = args[:date] || Date.current.strftime("%m-%d-%y")

    scraper = NytCrosswordScraper.new(date)
    data = scraper.scrape_clues

    puts "ACROSS CLUES (#{data[:across].length}):"
    data[:across].first(5).each do |clue|
      puts "  #{clue[:number]}. #{clue[:clue]} = #{clue[:answer]}"
    end

    puts "\nDOWN CLUES (#{data[:down].length}):"
    data[:down].first(5).each do |clue|
      puts "  #{clue[:number]}. #{clue[:clue]} = #{clue[:answer]}"
    end
  end
end
